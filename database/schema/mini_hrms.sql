-- Final schema for a NEW, EMPTY MySQL 8.0 database. No exported data.
USE `mini_hrms`;

CREATE TABLE `employees` (
  `userId` int NOT NULL AUTO_INCREMENT,
  `empId` varchar(50) NOT NULL,
  `firstName` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `lastName` varchar(50) DEFAULT NULL,
  `userName` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `address` json DEFAULT NULL COMMENT 'JSON Object(Address,City,State,Country,Pincode)',
  `profile` json DEFAULT NULL COMMENT 'JSON Object(Image,Mobile,DateOfBirth)',
  `roleName` varchar(20) NOT NULL DEFAULT 'employee' COMMENT 'enum(admin,employee,rm,pm,hr,fm,ceo,director)',
  `status` tinyint(1) NOT NULL DEFAULT '2' COMMENT 'enum(0,1,2,3), {0:"Blocked",1:"Active",2:"Pending",3:"Notice Period"}',
  `createdBy` int NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`userId`),
  UNIQUE KEY `empId` (`empId`),
  UNIQUE KEY `userName` (`userName`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `admin_login` (
  `adminLoginId` int NOT NULL AUTO_INCREMENT,
  `empId` varchar(50) NOT NULL,
  `adminLoginName` varchar(50) NOT NULL,
  `adminPassword` text NOT NULL COMMENT 'Password must be encrypted',
  `settingsPassword` text NOT NULL COMMENT 'Password must be encrypted',
  `loginStatus` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'enum(0,1,2,3), {0:"Offline",1:"Online",2:"Pending Change Password",3:"Password Expired"}',
  `lastLoginTime` varchar(100) DEFAULT NULL COMMENT 'Datetime',
  `passwordsInfo` json NOT NULL COMMENT 'JSON Object(Normal&Settings Password Updated Date&Expired Date Details)',
  `createdBy` int NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`adminLoginId`),
  UNIQUE KEY `empId` (`empId`),
  UNIQUE KEY `adminLoginName` (`adminLoginName`),
  CONSTRAINT `admin_login_ibfk_1` FOREIGN KEY (`empId`) REFERENCES `employees` (`empId`),
  CONSTRAINT `admin_login_ibfk_2` FOREIGN KEY (`adminLoginName`) REFERENCES `employees` (`userName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `attendance_types_details` (
  `attendTypeDetailId` int NOT NULL AUTO_INCREMENT,
  `attendanceName` varchar(50) NOT NULL COMMENT 'Daily,Weekly,Bi-weekly,Monthly',
  `attendanceCode` varchar(20) NOT NULL COMMENT 'DA,WA,BIA,MA',
  `attendanceType` varchar(50) NOT NULL COMMENT 'Bio-Metric,Online',
  `logOnTime` varchar(20) NOT NULL,
  `logOffTime` varchar(20) NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'enum(0,1), {0:"Inactive",1:"Active"}',
  `createdBy` int NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`attendTypeDetailId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `audit_employee_admin_login` (
  `auditEmpAdminLoginId` int NOT NULL AUTO_INCREMENT,
  `empId` varchar(50) NOT NULL,
  `loginType` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'enum(1,2,3) {1:"Normal",2:"Settings",3:"Social"}',
  `lastLoginTime` varchar(100) DEFAULT NULL COMMENT 'Datetime',
  `lastLogoutTime` varchar(100) DEFAULT NULL COMMENT 'Datetime',
  `sessionTime` varchar(50) DEFAULT NULL,
  `ipAddress` varchar(100) DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'enum(0,1), {0:"Inactive",1:"Active"}',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  KEY `empId` (`empId`),
  PRIMARY KEY (`auditEmpAdminLoginId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `audit_employee_attendance` (
  `auditEmpAttendId` int NOT NULL AUTO_INCREMENT,
  `empId` varchar(50) NOT NULL,
  `outTime` datetime NOT NULL,
  `inTime` datetime NOT NULL,
  `sessionTime` varchar(255) NOT NULL,
  `loginType` varchar(20) NOT NULL,
  `awayReason` text NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'enum(0,1), {0:"Inactive",1:"Active"}',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`auditEmpAttendId`),
  KEY `empId` (`empId`),
  CONSTRAINT `audit_employee_attendance_ibfk_1` FOREIGN KEY (`empId`) REFERENCES `employees` (`empId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `employee_attendance_details` (
  `empAttendDetailId` int NOT NULL AUTO_INCREMENT,
  `empId` varchar(50) NOT NULL,
  `loginTime` datetime NOT NULL,
  `logoutTime` datetime NOT NULL,
  `loginCode` varchar(10) NOT NULL,
  `loginType` varchar(20) NOT NULL,
  `attendanceStatus` tinyint(1) NOT NULL DEFAULT '2' COMMENT 'enum(0,1,2), {0:"Failed",1:"Success",2:"Pending"}',
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'enum(0,1), {0:"Inactive",1:"Active"}',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`empAttendDetailId`),
  KEY `empId` (`empId`),
  CONSTRAINT `employee_attendance_details_ibfk_1` FOREIGN KEY (`empId`) REFERENCES `employees` (`empId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `employee_attendance_saved_details` (
  `empAttendSaveDetailId` int NOT NULL AUTO_INCREMENT,
  `empId` varchar(50) NOT NULL,
  `bioMetricId` varchar(255) DEFAULT NULL,
  `onlineLoginId` varchar(255) DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'enum(0,1), {0:"Inactive",1:"Active"}',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`empAttendSaveDetailId`),
  UNIQUE KEY `empId` (`empId`),
  UNIQUE KEY `bioMetricId` (`bioMetricId`),
  UNIQUE KEY `onlineLoginId` (`onlineLoginId`),
  CONSTRAINT `employee_attendance_saved_details_ibfk_1` FOREIGN KEY (`empId`) REFERENCES `employees` (`empId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `employee_bank_details` (
  `empBankDetailId` int NOT NULL AUTO_INCREMENT,
  `empId` varchar(50) NOT NULL,
  `bankName` varchar(100) NOT NULL,
  `accountNumber` varchar(50) NOT NULL,
  `ifscCode` varchar(50) NOT NULL,
  `branchName` varchar(100) NOT NULL,
  `benificiaryName` varchar(100) DEFAULT NULL,
  `accountHolderName` varchar(100) NOT NULL,
  `accountType` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'enum(1,2,3), {1:"Saving",2:"Current",3:"Personal"}',
  `isCardActive` tinyint(1) DEFAULT NULL COMMENT 'enum(0,1), {0:"Inactive",1:"Active"}',
  `atmCardInfo` json DEFAULT NULL COMMENT 'JSON Object(ATM Card Details)',
  `generalInfo` json DEFAULT NULL COMMENT 'JSON Object(General Details)',
  `personalBanksInfo` json DEFAULT NULL COMMENT 'JSON Object(Personal Bank Details)',
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'enum(0,1), {0:"Inactive",1:"Active"}',
  `createdBy` int NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`empBankDetailId`),
  UNIQUE KEY `empId` (`empId`),
  CONSTRAINT `employee_bank_details_ibfk_1` FOREIGN KEY (`empId`) REFERENCES `employees` (`empId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `employee_basic_details` (
  `empBasicDetailId` int NOT NULL AUTO_INCREMENT,
  `empId` varchar(50) NOT NULL,
  `studyInfo` json DEFAULT NULL COMMENT 'JSON Object(Designation,Department)',
  `familyInfo` json DEFAULT NULL COMMENT 'JSON Object(Family Details)',
  `personalInfo` json DEFAULT NULL COMMENT 'JSON Object(Aadhar Card Number,Pan Card Number)',
  `backupInfo` json DEFAULT NULL COMMENT 'JSON Object(Backup email, Backup Mobile)',
  `socialMediaInfo` json DEFAULT NULL COMMENT 'JSON Object(Any Social Media Profile URL)',
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'enum(0,1), {0:"Inactive",1:"Active"}',
  `createdBy` int NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`empBasicDetailId`),
  UNIQUE KEY `empId` (`empId`),
  CONSTRAINT `employee_basic_details_ibfk_1` FOREIGN KEY (`empId`) REFERENCES `employees` (`empId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `employee_login` (
  `empLoginId` int NOT NULL AUTO_INCREMENT,
  `empId` varchar(50) NOT NULL,
  `empLoginName` varchar(50) NOT NULL,
  `empPassword` text NOT NULL COMMENT 'Password must be encrypted',
  `loginStatus` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'enum(0,1,2,3), {0:"Offline",1:"Online",2:"Pending Change Password",3:"Password Expired"}',
  `lastLoginTime` varchar(100) DEFAULT NULL COMMENT 'Datetime',
  `passwordUpdatedOn` datetime DEFAULT NULL COMMENT 'Datetime',
  `passwordExpiryDate` datetime DEFAULT NULL COMMENT 'Datetime',
  `createdBy` int NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`empLoginId`),
  UNIQUE KEY `empId` (`empId`),
  UNIQUE KEY `empLoginName` (`empLoginName`),
  CONSTRAINT `employee_login_ibfk_1` FOREIGN KEY (`empId`) REFERENCES `employees` (`empId`),
  CONSTRAINT `employee_login_ibfk_2` FOREIGN KEY (`empLoginName`) REFERENCES `employees` (`userName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `employee_onboarding_details` (
  `empOnboardDetailId` int NOT NULL AUTO_INCREMENT,
  `employeeInfo` json NOT NULL COMMENT 'JSON Object(FirstName,LastName,Email,Mobile)',
  `onBoardStartDate` varchar(50) NOT NULL,
  `approvedDate` varchar(50) DEFAULT NULL,
  `joiningDate` varchar(50) DEFAULT NULL,
  `approvedBy` varchar(50) DEFAULT NULL,
  `remarks` text,
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'enum(0,1), {0:"Inactive",1:"Active"}',
  `createdBy` int NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`empOnboardDetailId`),
  KEY `approvedBy` (`approvedBy`),
  CONSTRAINT `employee_onboarding_details_ibfk_1` FOREIGN KEY (`approvedBy`) REFERENCES `employees` (`empId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `employee_process_details` (
  `empProcessId` int NOT NULL AUTO_INCREMENT,
  `empId` varchar(50) DEFAULT NULL,
  `onBoardStartDate` varchar(50) DEFAULT NULL,
  `approvedDate` varchar(50) DEFAULT NULL,
  `approvedBy` varchar(50) DEFAULT NULL,
  `approvedRemarks` text,
  `rejectedDate` varchar(50) DEFAULT NULL,
  `rejectedBy` varchar(50) DEFAULT NULL,
  `rejectedRemarks` text,
  `status` tinyint(1) DEFAULT '1' COMMENT 'enum(0,1), {0:"On Hold",1:"Approved",2:"Rejected"}',
  `createdBy` int NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`empProcessId`),
  KEY `empId` (`empId`),
  KEY `approvedBy` (`approvedBy`),
  KEY `rejectedBy` (`rejectedBy`),
  CONSTRAINT `employee_process_details_ibfk_1` FOREIGN KEY (`approvedBy`) REFERENCES `employees` (`empId`),
  CONSTRAINT `employee_process_details_ibfk_2` FOREIGN KEY (`rejectedBy`) REFERENCES `employees` (`empId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `login_encrypt_details` (
  `loginEncDecDetailId` int NOT NULL AUTO_INCREMENT,
  `loginType` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'enum(1,2,3) {1:"Normal",2:"Settings",3:"Social"}',
  `encryptKey` text NOT NULL,
  `encryptType` varchar(50) NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'enum(0,1), {0:"Inactive",1:"Active"}',
  `createdBy` int NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`loginEncDecDetailId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
