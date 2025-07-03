/*───────────────────────────────────────────────────────────────
  MapuaInventory – full setup script
  Requirements : MySQL 8.0+
────────────────────────────────────────────────────────────────*/

/* 0) Recreate the database */
DROP DATABASE IF EXISTS `MapuaInventory`;
CREATE DATABASE `MapuaInventory`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE `MapuaInventory`;

/* 1) Users */
CREATE TABLE `Users` (
  `UserID`       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `FirstName`    VARCHAR(50)  NOT NULL,
  `LastName`     VARCHAR(50)  NOT NULL,
  `Email`        VARCHAR(100) NOT NULL UNIQUE,
  `ContactNo`    VARCHAR(30),
  `PasswordHash` VARCHAR(255),
  `Role`         ENUM('Admin','Viewer','Ticketing','Inventory') NOT NULL DEFAULT 'Inventory',
  `CreatedAt`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`Role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `Users` (`FirstName`,`LastName`,`Email`,`PasswordHash`,`Role`)
VALUES ('System','Account','system@localhost','', 'Admin');

/* 2) Rooms */
CREATE TABLE `Room` (
  `RoomID`      VARCHAR(10) NOT NULL,
  `Room_Config` INT         NOT NULL DEFAULT 1,
  `PC_NUM`      INT         NOT NULL DEFAULT 41,
  PRIMARY KEY (`RoomID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `Room` (`RoomID`,`Room_Config`,`PC_NUM`)
VALUES ('MPO310',1,41);

/* 3) Computers */
CREATE TABLE `Computers` (
  `RoomID`      VARCHAR(10) NOT NULL,
  `PCNumber`    CHAR(2)     NOT NULL COMMENT '00–40 = students',
  `Status`      ENUM('Working','Defective','Retired') NOT NULL DEFAULT 'Working',
  `LastUpdated` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `LastFixedAt` DATETIME    NULL,
  `LastFixedBy` INT UNSIGNED NULL,
  PRIMARY KEY (`RoomID`,`PCNumber`),
  FOREIGN KEY (`RoomID`) REFERENCES `Room`(`RoomID`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* seed student seats 00–40 (all default to Working) */
INSERT INTO `Computers` (`RoomID`,`PCNumber`)
SELECT 'MPO310', LPAD(t.t*10+u.u,2,'0')
  FROM (SELECT 0 t UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) t
 CROSS JOIN (SELECT 0 u UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
             UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) u
 WHERE (t.t*10+u.u) <= 40;

/* 4) ComputerStatusLog */
CREATE TABLE `ComputerStatusLog` (
  `LogID`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `RoomID`          VARCHAR(10) NOT NULL,
  `PCNumber`        CHAR(2)     NOT NULL,
  `CheckDate`       DATE        NOT NULL,
  `Status`          ENUM('Working','Defective') NOT NULL DEFAULT 'Working',
  `Issues`          SET('Mouse','Keyboard','Monitor','Operating System',
                       'Memory','CPU','GPU','Network','Other'),
  `UserID`          INT UNSIGNED NULL,
  `LoggedAt`        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ServiceTicketID` VARCHAR(100) UNIQUE,
  FOREIGN KEY (`RoomID`,`PCNumber`)
    REFERENCES `Computers`(`RoomID`,`PCNumber`)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`)
      ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* trigger to build ServiceTicketID (falls back to Checked) */
DELIMITER $$
DROP TRIGGER IF EXISTS trg_set_ticketid$$
CREATE TRIGGER trg_set_ticketid
BEFORE INSERT ON `ComputerStatusLog`
FOR EACH ROW
BEGIN
  DECLARE nxt BIGINT;
  DECLARE issueText VARCHAR(20);
  /* fetch next auto-inc for uniqueness */
  SELECT AUTO_INCREMENT
    INTO nxt
    FROM INFORMATION_SCHEMA.TABLES
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'ComputerStatusLog'
   LIMIT 1;
  SET issueText = SUBSTRING_INDEX(NEW.Issues, ',', 1);
  IF issueText IS NULL OR issueText = '' THEN
    SET issueText = 'Checked';
  END IF;
  SET NEW.ServiceTicketID = CONCAT(
    NEW.RoomID,'-',NEW.PCNumber,'-',issueText,'-',LPAD(nxt,9,'0')
  );
END$$
DELIMITER ;

/* 5) Fixes */
CREATE TABLE `Fixes` (
  `FixID`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `RoomID`         VARCHAR(10)  NOT NULL,
  `PCNumber`       CHAR(2)      NOT NULL,
  `FixedAt`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FixedBy`        INT UNSIGNED NULL,
  `ServiceTicketID` VARCHAR(100) NULL,
  FOREIGN KEY (`RoomID`,`PCNumber`)
    REFERENCES `Computers`(`RoomID`,`PCNumber`)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`FixedBy`) REFERENCES `Users`(`UserID`)
      ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (`ServiceTicketID`) REFERENCES `ComputerStatusLog`(`ServiceTicketID`)
      ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* 6) StatusLog */
CREATE TABLE `StatusLog` (
  `RoomID`    VARCHAR(10) NOT NULL,
  `PCNumber`  CHAR(2)     NOT NULL,
  `CheckDate` DATE        NOT NULL,
  `Status`    ENUM('Working','Defective') NOT NULL DEFAULT 'Working',
  `UserID`    INT UNSIGNED NULL,
  `LoggedAt`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`RoomID`,`PCNumber`,`CheckDate`),
  FOREIGN KEY (`RoomID`,`PCNumber`)
    REFERENCES `Computers`(`RoomID`,`PCNumber`)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`)
      ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* trigger to keep Computers in sync with StatusLog */
DELIMITER $$
DROP TRIGGER IF EXISTS trg_sync_statuslog$$
CREATE TRIGGER trg_sync_statuslog
AFTER INSERT ON `StatusLog`
FOR EACH ROW
BEGIN
  UPDATE `Computers`
    SET `Status`      = NEW.Status,
        `LastUpdated` = NEW.LoggedAt
  WHERE `RoomID`   = NEW.RoomID
    AND `PCNumber` = NEW.PCNumber;
END$$
DELIMITER ;

/* 7) Seed a full year (2025) of daily “Working” snapshots */
WITH RECURSIVE days AS (
  SELECT DATE('2025-01-01') AS d
  UNION ALL
  SELECT d + INTERVAL 1 DAY FROM days WHERE d < '2025-12-31'
)
INSERT INTO `StatusLog` (RoomID,PCNumber,CheckDate,Status,UserID)
SELECT
  'MPO310',
  LPAD(pc.n,2,'0'),
  days.d,
  'Working',
  1
FROM days
CROSS JOIN (
  SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
  UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
  UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14
  UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19
  UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24
  UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29
  UNION ALL SELECT 30 UNION ALL SELECT 31 UNION ALL SELECT 32 UNION ALL SELECT 33 UNION ALL SELECT 34
  UNION ALL SELECT 35 UNION ALL SELECT 36 UNION ALL SELECT 37 UNION ALL SELECT 38 UNION ALL SELECT 39
  UNION ALL SELECT 40
) AS pc;

/* 8) ComputerAssets & helper view & retire-event */
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
    ON a.RoomID=c.RoomID AND a.PCNumber=c.PCNumber
  SET c.Status='Retired'
  WHERE a.RetiredAt IS NULL
    AND a.InstalledAt <= DATE_SUB(CURDATE(), INTERVAL 5 YEAR);$$
DELIMITER ;

/* 9) Defects Trend view */
CREATE OR REPLACE VIEW `v_DefectsTrend` AS
  SELECT CheckDate AS d, COUNT(*) AS defects
    FROM `ComputerStatusLog`
   WHERE Status = 'Defective'
   GROUP BY CheckDate
   ORDER BY CheckDate;

/* 10) Students & BorrowedItems */
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
  `ItemCategory` ENUM('RJ45','Serial Cable','Keyboard','Mouse','PowerSupply','Other') NOT NULL,
  `ItemDetails`  VARCHAR(100) NULL,
  `BorrowedAt`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `DueAt`        DATETIME     NULL,
  `ReturnedAt`   DATETIME     NULL,
  `Status`       ENUM('Borrowed','Returned','Overdue') NOT NULL DEFAULT 'Borrowed',
  FOREIGN KEY (`StudentNo`) REFERENCES `Students`(`StudentNo`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX `idx_borrow_status` (`Status`),
  INDEX `idx_borrow_student` (`StudentNo`,`Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* 11) Ensure all enums default to Working */
ALTER TABLE `Computers`
  MODIFY `Status` ENUM('Working','Defective','Retired') NOT NULL DEFAULT 'Working';

ALTER TABLE `ComputerStatusLog`
  MODIFY `Status` ENUM('Working','Defective') NOT NULL DEFAULT 'Working';

ALTER TABLE `StatusLog`
  MODIFY `Status` ENUM('Working','Defective') NOT NULL DEFAULT 'Working';
