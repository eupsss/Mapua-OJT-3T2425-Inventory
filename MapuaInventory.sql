/*───────────────────────────────────────────────────────────
  MapuaInventory — portable full-setup script
  (MySQL ≥ 5.6  │  MariaDB ≥ 10.1)
───────────────────────────────────────────────────────────*/

-- 1. (Re)create DB
DROP DATABASE IF EXISTS `MapuaInventory`;
CREATE DATABASE `MapuaInventory`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE `MapuaInventory`;

/*────────────────────────  Users  ────────────────────────*/
CREATE TABLE `Users` (
  `UserID`       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `FirstName`    VARCHAR(50)  NOT NULL,
  `LastName`     VARCHAR(50)  NOT NULL,
  `Email`        VARCHAR(100) NOT NULL UNIQUE,
  `ContactNo`    VARCHAR(30),
  `PasswordHash` VARCHAR(255),
  `Role`         ENUM('Admin','Viewer') NOT NULL DEFAULT 'Viewer',
  `CreatedAt`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX `idx_users_role` ON `Users`(`Role`);

/*────────────────────────  Rooms  ────────────────────────*/
CREATE TABLE `Room` (
  `RoomID` VARCHAR(10) NOT NULL,
  PRIMARY KEY (`RoomID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `Room` VALUES ('MPO310');

/*───────────────────────  Computers  ─────────────────────*/
CREATE TABLE `Computers` (
  `RoomID`     VARCHAR(10) NOT NULL,
  `PCNumber`   CHAR(2)     NOT NULL COMMENT '00–40 = students, 41 = instructor',
  `Status`     ENUM('Available','In Use','Maintenance','Retired','Defective')
                 NOT NULL DEFAULT 'Available',
  `LastUpdated` DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`RoomID`,`PCNumber`),
  FOREIGN KEY (`RoomID`) REFERENCES `Room`(`RoomID`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* seed PCs 00-40 (portable numbers-table trick) */
INSERT INTO `Computers` (`RoomID`,`PCNumber`)
SELECT 'MPO310', LPAD(t.t*10+u.u,2,'0')
FROM (SELECT 0 t UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL
      SELECT 3 UNION ALL SELECT 4) t
CROSS JOIN
     (SELECT 0 u UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL
      SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL
      SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL
      SELECT 9) u
WHERE (t.t*10+u.u) <= 40;

INSERT INTO `Computers` VALUES ('MPO310','41','Available',NOW());

/*─────────────────  ComputerStatusLog  (per-event) ─────────────────
   • Surrogate PK  LogID  keeps every change.
   • Composite UNIQUE keeps the “one record per PC per day” rule.
──────────────────────────────────────────────────────────*/
CREATE TABLE `ComputerStatusLog` (
  `LogID`     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `RoomID`    VARCHAR(10) NOT NULL,
  `PCNumber`  CHAR(2)     NOT NULL,
  `CheckDate` DATE        NOT NULL,
  `Status`    ENUM('Working','Defective') NOT NULL,
  `Issues`    SET('Mouse','Keyboard','Monitor',
                  'Operating System','Memory','CPU','GPU','Network','Other') NULL,
  `UserID`    INT UNSIGNED NULL,
  `LoggedAt`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  

  FOREIGN KEY (`RoomID`,`PCNumber`)
    REFERENCES `Computers`(`RoomID`,`PCNumber`)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`)
      ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*─────────────────────  StatusLog  (daily snapshot) ───────────────────
   Still uses the composite PK and just references Computers.
────────────────────────────────────────────────────────────────────────*/
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

/*─────────────  Seed 2025 snapshot rows as “Working”  ───────────────*/
/* 1️⃣ system account */
INSERT INTO `Users`
  (`FirstName`,`LastName`,`Email`,`PasswordHash`,`Role`)
VALUES
  ('System','Account','system@localhost','', 'Admin');  -- ID = 1

/* 2️⃣ build a days table (365 rows) and cross-join with 00-40 */
CREATE TEMPORARY TABLE tmp_days (d DATE PRIMARY KEY);
INSERT INTO tmp_days (d)
SELECT DATE('2025-01-01') + INTERVAL seq DAY
FROM (
  SELECT @row:=@row+1 AS seq
  FROM (SELECT 0 UNION ALL SELECT 1) a, (SELECT 0 UNION ALL SELECT 1) b,
       (SELECT 0 UNION ALL SELECT 1) c, (SELECT 0 UNION ALL SELECT 1) d,
       (SELECT 0 UNION ALL SELECT 1) e, (SELECT @row:=-1) init
  LIMIT 365
) x;

INSERT INTO `StatusLog` (`RoomID`,`PCNumber`,`CheckDate`,`Status`,`UserID`)
SELECT 'MPO310',
       LPAD(n,2,'0'),
       d.d,
       'Working',
       1
FROM tmp_days d
CROSS JOIN (
  SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL
  SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL
  SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL
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
