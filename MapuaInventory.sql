/*───────────────────────────────────────────────────────────────
  MapuaInventory – full setup script
  Requirements : MySQL 5.7+  /  MariaDB 10.1+
───────────────────────────────────────────────────────────────*/

-- 0. (Re)create the DB
DROP DATABASE IF EXISTS `MapuaInventory`;
CREATE DATABASE `MapuaInventory`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE `MapuaInventory`;

/*────────────────────────── 1. Users ──────────────────────────*/
CREATE TABLE `Users` (
  `UserID`       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `FirstName`    VARCHAR(50)  NOT NULL,
  `LastName`     VARCHAR(50)  NOT NULL,
  `Email`        VARCHAR(100) NOT NULL UNIQUE,
  `ContactNo`    VARCHAR(30),
  `PasswordHash` VARCHAR(255),
  `Role`         ENUM('Admin','Viewer') NOT NULL DEFAULT 'Viewer',
  `CreatedAt`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`Role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*────────────────────────── 2. Rooms ──────────────────────────*/
CREATE TABLE `Room` (
  `RoomID` VARCHAR(10) NOT NULL,
  PRIMARY KEY (`RoomID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `Room` VALUES ('MPO310');

/*──────────────────────── 3. Computers ────────────────────────*/
CREATE TABLE `Computers` (
  `RoomID`      VARCHAR(10) NOT NULL,
  `PCNumber`    CHAR(2)     NOT NULL COMMENT '00–40 = students, 41 = instructor',
  `Status`      ENUM('Working','Defective')
                   NOT NULL DEFAULT 'Working',
  `LastUpdated` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`RoomID`,`PCNumber`),
  FOREIGN KEY (`RoomID`) REFERENCES `Room`(`RoomID`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* seed PCs 00–40 + instructor 41 – now all default to Working */
INSERT INTO `Computers` (`RoomID`,`PCNumber`)
SELECT 'MPO310', LPAD(t.t*10+u.u,2,'0')
  FROM (SELECT 0 t UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) t
 CROSS JOIN (SELECT 0 u UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
             UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) u
 WHERE (t.t*10+u.u) <= 40;

-- instructor station, explicitly mark as Working
INSERT INTO `Computers` (`RoomID`,`PCNumber`,`Status`,`LastUpdated`)
VALUES ('MPO310','41','Working',NOW());

/*──────────────────── 4. ComputerStatusLog ────────────────────*/
CREATE TABLE `ComputerStatusLog` (
  `LogID`     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `RoomID`    VARCHAR(10) NOT NULL,
  `PCNumber`  CHAR(2)     NOT NULL,
  `CheckDate` DATE        NOT NULL,
  `Status`    ENUM('Working','Defective') NOT NULL,
  `Issues`    SET(
                'Mouse','Keyboard','Monitor',
                'Operating System','Memory','CPU','GPU','Network','Other'
              ),
  `UserID`    INT UNSIGNED NULL,
  `LoggedAt`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ServiceTicketID` VARCHAR(100) UNIQUE,

  FOREIGN KEY (`RoomID`,`PCNumber`)
    REFERENCES `Computers`(`RoomID`,`PCNumber`)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`)
      ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*───────────── BEFORE-INSERT trigger to build ServiceTicketID ─────────────*/
DELIMITER $$
CREATE TRIGGER trg_set_ticketid
BEFORE INSERT ON ComputerStatusLog
FOR EACH ROW
BEGIN
  DECLARE nxt BIGINT;
  DECLARE issueText VARCHAR(20);

  /* next auto-increment value for LogID */
  SELECT AUTO_INCREMENT
    INTO nxt
    FROM INFORMATION_SCHEMA.TABLES
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'ComputerStatusLog'
   LIMIT 1;

  /* first issue (if multiple) */
  SET issueText = SUBSTRING_INDEX(NEW.Issues, ',', 1);

  /* Ticket:  ROOM-PC-ISSUE-000000123 */
  SET NEW.ServiceTicketID = CONCAT(
        NEW.RoomID, '-', NEW.PCNumber, '-', issueText, '-', LPAD(nxt, 9, '0')
      );
END$$
DELIMITER ;

/*────────────────────────── 5. Fixes ──────────────────────────*/
CREATE TABLE `Fixes` (
  `FixID`     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `RoomID`    VARCHAR(10)  NOT NULL,
  `PCNumber`  CHAR(2)      NOT NULL,
  `FixedAt`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FixedBy`   INT UNSIGNED NULL,

  FOREIGN KEY (`RoomID`,`PCNumber`)
    REFERENCES `Computers`(`RoomID`,`PCNumber`)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`FixedBy`) REFERENCES `Users`(`UserID`)
      ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*──────────────────── 6. StatusLog (daily snapshot) ───────────────────*/
CREATE TABLE `StatusLog` (
  `RoomID`    VARCHAR(10) NOT NULL,
  `PCNumber`  CHAR(2)     NOT NULL,
  `CheckDate` DATE        NOT NULL,
  `Status`    ENUM('Working','Defective') NOT NULL,
  `UserID`    INT UNSIGNED NULL,
  `LoggedAt`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`RoomID`,`PCNumber`,`CheckDate`),

  FOREIGN KEY (`RoomID`,`PCNumber`)
    REFERENCES `Computers`(`RoomID`,`PCNumber`)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`)
      ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*──────────────── trigger: keep Computers in sync with StatusLog ─────*/
DELIMITER $$
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

/*────────────────── 7. Misc columns on Computers ───────────────────*/
ALTER TABLE Computers
  ADD COLUMN LastFixedAt DATETIME NULL,
  ADD COLUMN LastFixedBy INT      NULL;

/*────────────────── 8. Seed data  ──────────────────────────*/
INSERT INTO `Users`
  (`FirstName`,`LastName`,`Email`,`PasswordHash`,`Role`)
VALUES
  ('System','Account','system@localhost','', 'Admin');  -- ID = 1

/* Pre-fill 2025 snapshot rows as "Working" */
CREATE TEMPORARY TABLE tmp_days (d DATE PRIMARY KEY);
INSERT INTO tmp_days
SELECT DATE('2025-01-01') + INTERVAL seq DAY
FROM (SELECT @row:=@row+1 AS seq
        FROM (SELECT 0 UNION ALL SELECT 1) a,
             (SELECT 0 UNION ALL SELECT 1) b,
             (SELECT 0 UNION ALL SELECT 1) c,
             (SELECT 0 UNION ALL SELECT 1) d,
             (SELECT 0 UNION ALL SELECT 1) e,
             (SELECT @row:=-1) init
      LIMIT 365) x;

INSERT INTO `StatusLog`
  (`RoomID`,`PCNumber`,`CheckDate`,`Status`,`UserID`)
SELECT
  'MPO310',
  LPAD(n,2,'0'),
  d.d,
  'Working',   -- was 'Available'
  1
FROM tmp_days d
CROSS JOIN (
  SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL
  SELECT 4  UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL
  SELECT 8  UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL
  SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 UNION ALL
  SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL
  SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL
  SELECT 24 UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL
  SELECT 28 UNION ALL SELECT 29 UNION ALL SELECT 30 UNION ALL SELECT 31 UNION ALL
  SELECT 32 UNION ALL SELECT 33 UNION ALL SELECT 34 UNION ALL SELECT 35 UNION ALL
  SELECT 36 UNION ALL SELECT 37 UNION ALL SELECT 38 UNION ALL SELECT 39 UNION ALL
  SELECT 40
) pc;
DROP TEMPORARY TABLE tmp_days;

CREATE TABLE `ComputerAssets` (
  `AssetID`       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `RoomID`        VARCHAR(10) NOT NULL,
  `PCNumber`      CHAR(2)     NOT NULL,
  /* life-cycle */
  `InstalledAt`   DATE        NOT NULL,
  `RetiredAt`     DATE        NULL,          -- NULL = still in service
  /* core specs */
  `MakeModel`     VARCHAR(100) NOT NULL,     -- e.g. “Dell OptiPlex 5000”
  `SerialNumber`  VARCHAR(100) NOT NULL,
  `CPU`           VARCHAR(100) NULL,
  `GPU`           VARCHAR(100) NULL,
  `RAM_GB`        SMALLINT     NULL,
  `Storage_GB`    SMALLINT     NULL,
  /* peripherals */
  `MonitorModel`  VARCHAR(100) NULL,
  `MonitorSerial` VARCHAR(100) NULL,
  `UPSModel`      VARCHAR(100) NULL,
  `UPSSerial`     VARCHAR(100) NULL,
  /* audit */
  `CreatedBy`     INT UNSIGNED NULL,
  `CreatedAt`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT `fk_assets_computers`
    FOREIGN KEY (`RoomID`,`PCNumber`)
    REFERENCES `Computers` (`RoomID`,`PCNumber`)
      ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT `fk_assets_user`
    FOREIGN KEY (`CreatedBy`) REFERENCES `Users`(`UserID`)
      ON UPDATE CASCADE ON DELETE SET NULL,

  /* one active asset per terminal */
  UNIQUE KEY `uk_active_asset`
    (`RoomID`,`PCNumber`,`RetiredAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*  Optional helper VIEW – current hardware only */
CREATE OR REPLACE VIEW `v_CurrentAssets` AS
SELECT *
FROM   `ComputerAssets`
WHERE  `RetiredAt` IS NULL;

/*  Optional daily event – flag PCs older than 5 years (status = Retired) */
DELIMITER $$
CREATE EVENT IF NOT EXISTS `ev_retire_old_pcs`
ON SCHEDULE EVERY 1 DAY
DO
  UPDATE `Computers`  AS c
  JOIN   `ComputerAssets` AS a
         ON a.RoomID = c.RoomID AND a.PCNumber = c.PCNumber
  SET    c.Status = 'Retired'
  WHERE  a.RetiredAt IS NULL
    AND  a.InstalledAt <= DATE_SUB(CURDATE(), INTERVAL 5 YEAR);$$
DELIMITER ;

/* 2.  Expand user roles */
ALTER TABLE `Users`
  MODIFY `Role`
    ENUM('Admin','Ticketing','Inventory') NOT NULL DEFAULT 'Inventory';


CREATE OR REPLACE VIEW v_DefectsTrend AS
SELECT
  CheckDate AS d,
  COUNT(*)  AS defects
FROM ComputerStatusLog
WHERE Status = 'Defective'
GROUP BY CheckDate
ORDER BY CheckDate;






/*──────────────────────────── Done ───────────────────────────*/
