/*───────────────────────────────────────────────────────────────
  MapuaInventory – schema-only setup script  (FIXED 2025-07-07)
  Requirements : MySQL 8.0+
────────────────────────────────────────────────────────────────*/

/*----------------------------------------------------------------
  0)  Drop + recreate the database
----------------------------------------------------------------*/
DROP DATABASE IF EXISTS `MapuaInventory`;
CREATE DATABASE `MapuaInventory`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE `MapuaInventory`;

/*----------------------------------------------------------------
  1)  Users
----------------------------------------------------------------*/
CREATE TABLE `Users` (
  `UserID`       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `FirstName`    VARCHAR(50)  NOT NULL,
  `LastName`     VARCHAR(50)  NOT NULL,
  `Email`        VARCHAR(100) NOT NULL UNIQUE,
  `ContactNo`    VARCHAR(30),
  `PasswordHash` VARCHAR(255),
  `Role`         ENUM('Admin','Viewer','Ticketing','Inventory')
                   NOT NULL DEFAULT 'Inventory',
  `CreatedAt`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`Role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*----------------------------------------------------------------
  2)  Rooms
----------------------------------------------------------------*/
CREATE TABLE `Room` (
  `RoomID`      VARCHAR(10) NOT NULL,
  `Room_Config` INT          NOT NULL DEFAULT 1,
  `PC_NUM`      INT          NOT NULL DEFAULT 41,
  PRIMARY KEY (`RoomID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*----------------------------------------------------------------
  3)  Computers
----------------------------------------------------------------*/
CREATE TABLE `Computers` (
  `RoomID`      VARCHAR(10) NOT NULL,
  `PCNumber`    CHAR(2)     NOT NULL COMMENT '00–40 = students',
  `Status`      ENUM('Working','Defective','Retired')
                  NOT NULL DEFAULT 'Working',
  `LastUpdated` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `LastFixedAt` DATETIME    NULL,
  `LastFixedBy` INT UNSIGNED NULL,
  PRIMARY KEY (`RoomID`,`PCNumber`),
  FOREIGN KEY (`RoomID`) REFERENCES `Room`(`RoomID`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*----------------------------------------------------------------
  4)  ComputerStatusLog + auto-ticket trigger
----------------------------------------------------------------*/
CREATE TABLE `ComputerStatusLog` (
  `LogID`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `RoomID`          VARCHAR(10) NOT NULL,
  `PCNumber`        CHAR(2)     NOT NULL,
  `CheckDate`       DATE        NOT NULL,
  `Status`          ENUM('Working','Defective')
                    NOT NULL DEFAULT 'Working',
  `Issues`          VARCHAR(255) NULL,
  `UserID`          INT UNSIGNED NULL,
  `LoggedAt`        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ServiceTicketID` VARCHAR(100) UNIQUE,
  FOREIGN KEY (`RoomID`,`PCNumber`)
    REFERENCES `Computers`(`RoomID`,`PCNumber`)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`)
      ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DELIMITER $$

CREATE TRIGGER `trg_set_ticketid`
BEFORE  INSERT ON `ComputerStatusLog`
FOR EACH ROW
BEGIN
  IF NEW.ServiceTicketID IS NULL THEN
    -- base: ROOM-PC-firstIssueOrChecked
    SET @base = CONCAT(
      NEW.RoomID, '-',
      NEW.PCNumber, '-',
      IFNULL(NULLIF(SUBSTRING_INDEX(NEW.Issues, ',', 1), ''), 'Checked')
    );
    -- suffix: a compact UUID (hex only, no hyphens)
    SET NEW.ServiceTicketID = CONCAT(
      @base, '-',
      REPLACE(UUID(), '-', '')
    );
  END IF;
END $$
DELIMITER ;


/*----------------------------------------------------------------
  5)  Fixes (+ enforce non-null ticket + cascading delete)
----------------------------------------------------------------*/
CREATE TABLE `Fixes` (
  `FixID`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `RoomID`         VARCHAR(10) NOT NULL,
  `PCNumber`       CHAR(2)     NOT NULL,
  `FixedAt`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FixedBy`        INT UNSIGNED NULL,
  `ServiceTicketID` VARCHAR(100) NOT NULL,
  FOREIGN KEY (`RoomID`,`PCNumber`)
    REFERENCES `Computers`(`RoomID`,`PCNumber`)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`FixedBy`) REFERENCES `Users`(`UserID`)
      ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (`ServiceTicketID`) REFERENCES `ComputerStatusLog`(`ServiceTicketID`)
      ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE KEY `uk_fix_ticket` (`ServiceTicketID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*----------------------------------------------------------------
  6)  Auto-insert fix + snapshot-update trigger
----------------------------------------------------------------*/
DELIMITER $$
CREATE TRIGGER trg_automate_fix
AFTER INSERT ON `ComputerStatusLog`
FOR EACH ROW
BEGIN
  IF NEW.Status = 'Working' THEN
    -- 6a) insert a fix record
    INSERT INTO `Fixes`
      (RoomID, PCNumber, FixedAt, FixedBy, ServiceTicketID)
    VALUES
      (NEW.RoomID, NEW.PCNumber, NEW.LoggedAt, NEW.UserID, NEW.ServiceTicketID);

    -- 6b) update the master Computers table
    UPDATE `Computers`
       SET `Status`      = 'Working',
           `LastFixedAt` = NEW.LoggedAt,
           `LastFixedBy` = NEW.UserID,
           `LastUpdated` = NEW.LoggedAt
     WHERE RoomID   = NEW.RoomID
       AND PCNumber = NEW.PCNumber;
  ELSE
    -- defective => mark machine down
    UPDATE `Computers`
       SET `Status`      = 'Defective',
           `LastUpdated` = NEW.LoggedAt
     WHERE RoomID   = NEW.RoomID
       AND PCNumber = NEW.PCNumber;
  END IF;
END$$
DELIMITER ;

/*----------------------------------------------------------------
  7)  ComputerAssets & retire-old event
----------------------------------------------------------------*/
CREATE TABLE `ComputerAssets` (
  `AssetID`       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `RoomID`        VARCHAR(10) NOT NULL,
  `PCNumber`      CHAR(2)     NOT NULL,
  `InstalledAt`   DATE        NOT NULL,
  `RetiredAt`     DATE        NULL,
  `MakeModel`     VARCHAR(100) NOT NULL,
  `SerialNumber`  VARCHAR(100) NOT NULL,
  `CPU`           VARCHAR(100) NULL,
  `GPU`           VARCHAR(100) NULL,
  `RAM_GB`        SMALLINT     NULL,
  `Storage_GB`    SMALLINT     NULL,
  `MonitorModel`  VARCHAR(100) NULL,
  `MonitorSerial` VARCHAR(100) NULL,
  `UPSModel`      VARCHAR(100) NULL,
  `UPSSerial`     VARCHAR(100) NULL,
  `CreatedBy`     INT UNSIGNED NULL,
  `CreatedAt`     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`RoomID`,`PCNumber`)
    REFERENCES `Computers`(`RoomID`,`PCNumber`)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`CreatedBy`) REFERENCES `Users`(`UserID`)
      ON UPDATE CASCADE ON DELETE SET NULL,
  UNIQUE KEY `uk_active_asset` (`RoomID`,`PCNumber`,`RetiredAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE OR REPLACE VIEW `v_CurrentAssets` AS
  SELECT * FROM `ComputerAssets` WHERE `RetiredAt` IS NULL;

DELIMITER $$
CREATE EVENT IF NOT EXISTS `ev_retire_old_pcs`
ON SCHEDULE EVERY 1 DAY
DO
  UPDATE `Computers` AS c
  JOIN `ComputerAssets` AS a
    ON a.RoomID=c.RoomID
   AND a.PCNumber=c.PCNumber
  SET c.Status='Retired'
  WHERE a.RetiredAt IS NULL
    AND a.InstalledAt <= DATE_SUB(CURDATE(), INTERVAL 5 YEAR);$$
DELIMITER ;

/*----------------------------------------------------------------
  8)  Defects trend view
----------------------------------------------------------------*/
CREATE OR REPLACE VIEW `v_DefectsTrend` AS
  SELECT CheckDate AS d, COUNT(*) AS defects
    FROM `ComputerStatusLog`
   WHERE Status = 'Defective'
   GROUP BY CheckDate
   ORDER BY CheckDate;

/*----------------------------------------------------------------
  9)  Students & BorrowedItems
----------------------------------------------------------------*/
CREATE TABLE `Students` (
  `StudentNo` CHAR(10) NOT NULL COMMENT 'YYYYxxxxxx',
  `FirstName` VARCHAR(50) NOT NULL,
  `LastName`  VARCHAR(50) NOT NULL,
  `ContactNo` VARCHAR(30),
  `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`StudentNo`),
  INDEX `idx_students_contact` (`ContactNo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `BorrowedItems` (
  `BorrowID`     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `StudentNo`    CHAR(10)     NOT NULL,
  `ItemCategory` ENUM(
      'RJ45','Serial Cable','Keyboard','Mouse',
      'PowerSupply','Other'
    ) NOT NULL DEFAULT 'Other',
  `ItemDetails`  VARCHAR(100) NULL,
  `BorrowedAt`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `DueAt`        DATETIME     NULL,
  `ReturnedAt`   DATETIME     NULL,
  `Status`       ENUM('Borrowed','Returned','Overdue')
                   NOT NULL DEFAULT 'Borrowed',
  FOREIGN KEY (`StudentNo`) REFERENCES `Students`(`StudentNo`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX `idx_borrow_status`  (`Status`),
  INDEX `idx_borrow_student` (`StudentNo`,`Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*----------------------------------------------------------------
  10) Enforce enum defaults
----------------------------------------------------------------*/
ALTER TABLE `Computers`
  MODIFY `Status` ENUM('Working','Defective','Retired')
    NOT NULL DEFAULT 'Working';

ALTER TABLE `ComputerStatusLog`
  MODIFY `Status` ENUM('Working','Defective')
    NOT NULL DEFAULT 'Working';

CREATE TABLE IF NOT EXISTS DailyTicketSeq (
  seq_date DATE         NOT NULL PRIMARY KEY,
  seq      INT UNSIGNED NOT NULL
) ENGINE=InnoDB CHARSET=utf8mb4;
