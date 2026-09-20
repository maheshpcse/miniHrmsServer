-- For a NEW database only. Existing routines are preserved by the Knex migration.
USE `mini_hrms`;
DELIMITER $$
CREATE FUNCTION `get_emp_name_by_created_by`(ip_created_by int) RETURNS varchar(255) CHARSET utf8mb4
READS SQL DATA
BEGIN
	   declare var_emp_name varchar(255);
	   
	   set var_emp_name = (select CONCAT(firstName, ' ', lastName) from employees where userId = ip_created_by);
	   
	   return var_emp_name;
    END$$

CREATE PROCEDURE `get_employee_process_data_by_id`(IN ip_empId VARCHAR(50), out op_employee_process_info json)
BEGIN	
		-- DATA (Employee Process Info)		
		-- select * from employee_process_details WHERE empId = ip_empId;
		
		DECLARE var_set_finished INT(11) DEFAULT 0;
		DECLARE var_empProcessId INT DEFAULT NULL;
		DECLARE var_empId VARCHAR(50) DEFAULT NULL;
		DECLARE var_onBoardStartDate VARCHAR(50) DEFAULT NULL;
		DECLARE var_approvedDate VARCHAR(50) DEFAULT NULL;
		DECLARE var_approvedBy VARCHAR(50) DEFAULT NULL;
		DECLARE var_approvedRemarks text DEFAULT NULL;
		DECLARE var_rejectedDate VARCHAR(50) DEFAULT NULL;
		DECLARE var_rejectedBy VARCHAR(50) DEFAULT NULL;
		DECLARE var_rejectedRemarks TEXT DEFAULT NULL;
		declare var_status tinyint(1) default null;
		DECLARE var_createdBy int DEFAULT NULL;
		DECLARE var_createdAt datetime DEFAULT NULL;
		DECLARE var_updatedAt DATETIME DEFAULT NULL;
		declare var_approvedUserId int default null;
		declare var_approvedFullname text default null;
		declare var_approvedImage text default null;
		declare var_approvedRoleName varchar(20) default null;
		
		DECLARE var_array_data JSON DEFAULT NULL;
		DECLARE var_object_data JSON DEFAULT NULL;
		DECLARE var_set_data TEXT DEFAULT NULL;
		
		-- START Cursor Loop
		DECLARE curEmployeeSearch CURSOR FOR SELECT epd.empProcessId, epd.empId, epd.onBoardStartDate, epd.approvedDate, epd.approvedBy, 
		epd.approvedRemarks, epd.rejectedDate, epd.rejectedBy, epd.rejectedRemarks, epd.status, epd.createdBy, epd.createdAt, epd.updatedAt, 
		e.userId as approvedUserId, concat(e.firstName, ' ', e.lastName) as approvedFullName, json_unquote(json_extract(e.profile, '$.Image')) 
		as approvedImage, e.roleName as approvedRoleName 
		FROM employee_process_details as epd 
		inner join employees as e on (e.empId = epd.approvedBy or e.empId = epd.rejectedby) 
		WHERE epd.empId = ip_empId;
		
		DECLARE CONTINUE HANDLER FOR NOT FOUND SET var_set_finished = 1;
		
		OPEN curEmployeeSearch;
		updateMerchantSearchType: LOOP 
			
			FETCH curEmployeeSearch INTO var_empProcessId, var_empId, var_onBoardStartDate, var_approvedDate, var_approvedBy, var_approvedRemarks, 
			var_rejectedDate, var_rejectedBy, var_rejectedRemarks, var_status, var_createdBy, var_createdAt, var_updatedAt, var_approvedUserId, 
			var_approvedFullname, var_approvedImage, var_approvedRoleName;
			
			IF var_set_finished = 1 THEN 
				LEAVE updateMerchantSearchType;
			END IF;
			
			IF var_empProcessId IS NOT NULL THEN 
				SET var_object_data = JSON_OBJECT('empProcessId',var_empProcessId,'empId',var_empId,'onBoardStartDate',var_onBoardStartDate,
				'approvedDate',var_approvedDate,'approvedBy',var_approvedBy,'approvedRemarks',var_approvedRemarks,'rejectedDate',
				var_rejectedDate,'rejectedBy',var_rejectedBy,'rejectedRemarks',var_rejectedRemarks,'status',var_status,'createdBy',
				var_createdBy,'createdAt',var_createdAt,'updatedAt',var_updatedAt, 'approvedUserId',var_approvedUserId,'approvedFullName',
				var_approvedFullname,'approvedImage',var_approvedImage,'approvedRoleName',var_approvedRoleName);
				-- select var_object_data;
				
				IF var_set_data IS NOT NULL THEN 
					SET var_set_data = CONCAT(var_set_data, ',', var_object_data);
				ELSE 
					SET var_set_data = CONCAT(var_object_data, '');
				END IF;
			ELSE 
				SET var_set_data = null;
			END IF;
			
		END LOOP updateMerchantSearchType;
		CLOSE curEmployeeSearch;
		-- END Cursor Loop
		
		-- SELECT var_set_data;
		
		if var_set_data is not null then 
			SELECT CONCAT('[', var_set_data, ']') INTO var_array_data;
		else 
			select '[]' INTO var_array_data;
		end if;
		
		SELECT var_array_data into op_employee_process_info;

	END$$

CREATE PROCEDURE `add_default_admin_login_data`(
	IN ip_userId INT(11),
	in ip_empId varchar(50),
	IN ip_fisrtName VARCHAR(50),
	IN ip_lastName VARCHAR(50),
	IN ip_userName VARCHAR(50),
	IN ip_email VARCHAR(100),
	IN ip_address json,
	IN ip_profile JSON,
	IN ip_roleName VARCHAR(20),
	IN ip_status TINYINT(1),
	in ip_createdBy int(11),
	IN ip_createdAt DATETIME,
	IN ip_updatedAt TIMESTAMP,
	in ip_adminLoginId int(11),
	in ip_adminPassword text,
	in ip_settingsPassword text,
	in ip_loginStatus tinyint(1),
	in ip_lastLoginTime varchar(100),
	in ip_passwordsInfo json
)
BEGIN
        DECLARE EXIT HANDLER FOR SQLEXCEPTION
        BEGIN
            ROLLBACK;
            RESIGNAL;
        END;
        START TRANSACTION;

		-- insert the default employees(admin) table data
		INSERT INTO employees 
		VALUES(ip_userId, ip_empId, ip_fisrtName, ip_lastName, ip_userName, ip_email, ip_address, ip_profile, 
		ip_roleName, ip_status, ip_createdBy, ip_createdAt, ip_updatedAt);
		
		INSERT INTO admin_login 
		VALUES(ip_adminLoginId, ip_empId, ip_userName, ip_adminPassword, ip_settingsPassword, ip_loginStatus, 
		ip_lastLoginTime, ip_passwordsInfo, ip_createdBy, ip_createdAt, ip_updatedAt);
		-- end
		
		COMMIT;
        select last_insert_id() as last_inserted_id;
	END$$

CREATE PROCEDURE `get_admin_and_settings_logout`(IN ip_adminLoginId INT(11), ip_auditLoginId int(11))
BEGIN 
		declare var_last_login varchar(100) default null;
		DECLARE var_last_logout VARCHAR(100) DEFAULT NULL;
		declare var_seconds bigint default null;
		declare var_hours_diff int(11) default null;
		DECLARE var_minutes_diff INT(11) DEFAULT NULL;
		DECLARE var_seconds_diff INT(11) DEFAULT NULL;
		declare var_login_duration varchar(50) default null;
		
		SELECT lastLoginTime INTO var_last_login FROM admin_login WHERE adminLoginId = ip_adminLoginId;
		set var_last_logout = now();
		
		select TIMESTAMPDIFF(SECOND, var_last_login, var_last_logout) into var_seconds;
		select FLOOR (var_seconds / 3600) INTO var_hours_diff;
		SELECT FLOOR (MOD (var_seconds, 3600)/ 60) INTO var_minutes_diff;
		SELECT MOD (MOD (var_seconds, 3600), 60) INTO var_seconds_diff;
		SELECT CONCAT (var_hours_diff, ":", var_minutes_diff, ":", var_seconds_diff) into var_login_duration;

		UPDATE admin_login SET loginStatus = 0 WHERE adminLoginId = ip_adminLoginId;
		
		update audit_employee_admin_login set lastLogoutTime = var_last_logout, sessionTime = var_login_duration 
		where auditEmpAdminLoginId = ip_auditLoginId;
	END$$

CREATE PROCEDURE `get_admin_login`(IN ip_adminLoginName VARCHAR(100))
BEGIN
		SELECT al.adminLoginId, al.adminLoginName, al.adminPassword, al.loginStatus, al.lastLoginTime, 
		JSON_UNQUOTE(JSON_EXTRACT(al.passwordsInfo, '$.LoginPasswordExpiryDate')) as loginPasswordExpiryDate, e.* 
		FROM `admin_login` AS al 
		INNER JOIN `employees` AS e USING(empId) 
		WHERE al.adminLoginName = ip_adminLoginName or al.empId = ip_adminLoginName;
	END$$

CREATE PROCEDURE `get_all_employees_data`(IN ip_limit INT(11), IN ip_offset INT(11))
BEGIN
		SET ip_offset = ((ip_offset - 1) * ip_limit);
		
		-- DATA
		select e.*,
		CASE WHEN e.status = 1 THEN 'Active' 
		     WHEN e.status = 0 THEN 'Inactive' 
		END AS statusName,
		CONCAT(e.firstName, ' ', e.lastName) AS empName,
		get_emp_name_by_created_by(e.createdBy) as createdByName 
		from `employees` as e 
		where e.empId != 'ADMIN001' 
		LIMIT ip_limit OFFSET ip_offset;
		
		-- COUNT
		select count(*) as `count` 
		FROM `employees` AS e 
		where e.empId != 'ADMIN001';
	END$$

CREATE PROCEDURE `get_employee_data_by_id`(IN ip_empId VARCHAR(50))
BEGIN
		declare var_employee_info json default null;
		declare var_emp_basic_info json default null;
		DECLARE var_emp_bank_info JSON DEFAULT NULL;
		DECLARE var_emp_onboarding_info JSON DEFAULT NULL;
		DECLARE var_emp_process_info JSON DEFAULT '[]';
		
		-- DATA (Employee Info)
		SELECT JSON_OBJECT('userId',e.userId,'empId',e.empId,'firstName',e.firstName,'lastName',e.lastName,'userName',e.userName,'email',
		e.email,'address',e.address,'profile',e.profile,'roleName',e.roleName,'status',e.status,'createdBy',e.createdBy,'createdAt',
		e.createdAt,'updatedAt',e.updatedAt,'statusName',
		CASE WHEN e.status = 1 THEN 'Active' 
		     WHEN e.status = 0 THEN 'Inactive' 
		END,
		'empName',CONCAT(e.firstName, ' ', e.lastName),
		'createdByName',get_emp_name_by_created_by(e.createdBy)) into var_employee_info 
		FROM `employees` AS e 
		WHERE e.empId = ip_empId;
		
		-- DATA (Employee Basic Info)
		SELECT JSON_OBJECT('empBasicDetailId',e.empBasicDetailId,'empId',e.empId,'studyInfo',e.studyInfo,'familyInfo',e.familyInfo,'personalInfo',
		e.personalInfo,'backupInfo',e.backupInfo,'socialMediaInfo',e.socialMediaInfo,'status',e.status,'createdBy',e.createdBy,'createdAt',
		e.createdAt,'updatedAt',e.updatedAt,'statusName',
		CASE WHEN e.status = 1 THEN 'Active' 
		     WHEN e.status = 0 THEN 'Inactive' 
		END,
		'createdByName',get_emp_name_by_created_by(e.createdBy)) INTO var_emp_basic_info 
		FROM `employee_basic_details` AS e 
		WHERE e.empId = ip_empId;
		
		-- DATA (Employee Bank Info)
		SELECT JSON_OBJECT('empBankDetailId',e.empBankDetailId,'empId',e.empId,'bankName',e.bankName,'accountNumber',e.accountNumber,'ifscCode',
		e.ifscCode,'branchName',e.branchName,'benificiaryName',e.benificiaryName,'accountHolderName',e.accountHolderName,'accountType',e.accountType,
		'isCardActive',e.isCardActive,'atmCardInfo',e.atmCardInfo,'generalInfo',e.generalInfo,'personalBanksInfo',e.personalBanksInfo,'status',e.status,
		'createdBy',e.createdBy,'createdAt',e.createdAt,'updatedAt',e.updatedAt,
		'accountTypeName',
		CASE WHEN e.accountType = 1 THEN 'Saving' 
		     WHEN e.accountType = 2 THEN 'Current' 
		     WHEN e.accountType = 3 THEN 'Personal' 
		END,
		'isCardActiveName',
		CASE WHEN e.isCardActive = 1 THEN 'Yes' 
		     WHEN e.isCardActive = 0 THEN 'No' 
		END,
		'statusName',
		CASE WHEN e.status = 1 THEN 'Active' 
		     WHEN e.status = 0 THEN 'Inactive' 
		END,
		'createdByName',get_emp_name_by_created_by(e.createdBy)) INTO var_emp_bank_info 
		FROM `employee_bank_details` AS e 
		WHERE e.empId = ip_empId;
		
		-- DATA (Employee Onboarding Info)
		SELECT JSON_OBJECT('empOnboardDetailId',e.empOnboardDetailId,'employeeInfo',e.employeeInfo,'onBoardStartDate',e.onBoardStartDate,
		'approvedDate',e.approvedDate,'joiningDate',e.joiningDate,'approvedBy',e.approvedBy,'remarks',e.remarks,'status',e.status,'createdBy',
		e.createdBy,'createdAt',e.createdAt,'updatedAt',e.updatedAt,'statusName',
		CASE WHEN e.status = 1 THEN 'Active' 
		     WHEN e.status = 0 THEN 'Inactive' 
		END,
		'createdByName',get_emp_name_by_created_by(e.createdBy)) INTO var_emp_onboarding_info 
		FROM `employee_onboarding_details` AS e 
		WHERE JSON_EXTRACT(e.employeeInfo, '$.empId') = ip_empId;
		
		-- DATA (Employee Process Info)
		CALL get_employee_process_data_by_id(ip_empId, @var_employee_procee_data);
		-- select @var_employee_procee_data;
		IF @var_employee_procee_data IS NOT NULL THEN 
			SELECT @var_employee_procee_data INTO var_emp_process_info;
		END IF;
		
		SELECT json_object('employeeInfo',var_employee_info,'empBasicInfo',var_emp_basic_info,'empBankInfo',var_emp_bank_info,
		'empOnboardingInfo',var_emp_onboarding_info, 'empProcessInfo', var_emp_process_info) as employeeData;
	END$$

CREATE PROCEDURE `get_login_encrypt_data`(IN ip_limit INT(11), IN ip_offset INT(11))
BEGIN
		SET ip_offset = ((ip_offset - 1) * ip_limit);
		
		-- DATA
		select led.*,
		case when led.loginType = 1 then 'Normal' 
		     when led.loginType = 2 THEN 'Settings' 
		     WHEN led.loginType = 3 THEN 'Social' 
		end as loginTypeName,
		CASE WHEN led.status = 1 THEN 'Active' 
		     WHEN led.status = 0 THEN 'Inactive' 
		END AS statusName,
		concat(e.firstName, ' ', e.lastName) as createdByName,
		e.empId 
		from `login_encrypt_details` as led 
		inner join `employees` as e on e.userId = led.createdBy 
		LIMIT ip_limit OFFSET ip_offset;
		
		-- COUNT
		select count(*) as `count` 
		FROM `login_encrypt_details` AS led 
		INNER JOIN `employees` AS e ON e.userId = led.createdBy;
	END$$

CREATE PROCEDURE `get_login_history_data`(in ip_limit int(11), in ip_offset int(11))
BEGIN
		SET ip_offset = ((ip_offset - 1) * ip_limit);
		
		-- DATA
		SELECT aeal.*,
		CASE WHEN aeal.loginType = 1 THEN 'Normal' 
		     WHEN aeal.loginType = 2 THEN 'Settings' 
		     WHEN aeal.loginType = 3 THEN 'Social' 
		END AS loginTypeName,
		CASE WHEN aeal.status = 1 THEN 'Active' 
		     WHEN aeal.status = 0 THEN 'Inactive' 
		END AS statusName,
		CONCAT(e.firstName, ' ', e.lastName) AS empName 
		FROM `audit_employee_admin_login` AS aeal 
		INNER JOIN `employees` AS e ON e.empId = aeal.empId 
		limit ip_limit offset ip_offset;
		
		-- COUNT
		SELECT COUNT(*) AS `count` 
		FROM `audit_employee_admin_login` AS aeal 
		INNER JOIN `employees` AS e ON e.empId = aeal.empId;
	END$$

CREATE PROCEDURE `get_validate_admin_email`(IN ip_adminEmail varchar(100))
BEGIN
		declare var_admil_email varchar(200) default null;
		DECLARE var_admil_username VARCHAR(200) DEFAULT NULL;
		
		select email, userName into var_admil_email, var_admil_username from employees where email = ip_adminEmail;
		
		if (var_admil_email is not null) then 
			select true as isValidEmail, var_admil_username as userName;
		else select false as isValidEmail, var_admil_username as userName;
		end if;
	END$$

CREATE PROCEDURE `save_audit_employee_admin_login`(
	in ip_empId varchar(50),
	in ip_loginType tinyint(1),
	in ip_lastLoginTime varchar(100),
	in ip_lastLogoutTime varchar(100),
	in ip_sessionTime varchar(50),
	in ip_ipAddress varchar(100)
)
BEGIN 
		DECLARE var_user_id INT(11) DEFAULT NULL;
		
		SELECT e.userId into var_user_id FROM admin_login AS al 
		INNER JOIN `employees` AS e USING(empId) 
		WHERE al.empId = ip_empId;
		
		set ip_lastLoginTime = CURRENT_TIMESTAMP();
		
		IF var_user_id IS NOT NULL AND var_user_id > 0 THEN 
			UPDATE admin_login SET loginStatus = 1, lastLoginTime = ip_lastLoginTime WHERE empId = ip_empId;
			
			INSERT INTO `audit_employee_admin_login` 
			VALUES(NULL, ip_empId, ip_loginType, ip_lastLoginTime, ip_lastLogoutTime, ip_sessionTime, ip_ipAddress, 1, NOW(), NOW());
			
			select last_insert_id() as audit_login_id;
		else 
			select 0 as audit_login_id;
		END IF;
	END$$

CREATE PROCEDURE `save_login_encrypt_data`(
	in ip_loginEncDecDetailId int(11),
	in ip_loginType tinyint(1),
	in ip_encryptKey text,
	in ip_encryptType varchar(50),
	in ip_createdBy int(11)
)
BEGIN
		if (ip_loginEncDecDetailId = 0 or ip_loginEncDecDetailId is null) then 
			insert into login_encrypt_details(`loginEncDecDetailId`,`loginType`,`encryptKey`,`encryptType`,`status`,`createdBy`) 
			select ip_loginEncDecDetailId, ip_loginType, ip_encryptKey, ip_encryptType, 1, ip_createdBy;
		else 
			update login_encrypt_details 
			set `loginType` = ip_loginType, `encryptKey` = ip_encryptKey, `encryptType` = ip_encryptType, `createdBy` = ip_createdBy 
			where `loginEncDecDetailId` = ip_loginEncDecDetailId;
		end if;
	END$$

CREATE PROCEDURE `update_admin_password`(
	IN ip_admin_email varchar(255),
	IN ip_new_password TEXT
)
BEGIN	
		declare var_emp_id varchar(100) default null;
		declare var_updated_on text default null;
		declare var_expiray_date text default null;
		declare var_current_expiry_date text default null;
		
		
		set var_emp_id = (select empId from employees where email = ip_admin_email);
		
		SET var_updated_on = (date_format(now(), "%Y-%m-%d %H:%i:%S"));
		
		
		update admin_login 
		set adminPassword = ip_new_password, passwordsInfo = JSON_SET(passwordsInfo, "$.LoginPasswordUpdatedOn", var_updated_on) 
		where empId = var_emp_id;
		
		
		-- Set Password Expiry Date
		set var_current_expiry_date = (select json_unquote(json_extract(passwordsInfo, "$.LoginPasswordExpiryDate")) from admin_login where empId = var_emp_id);
		
		if(var_current_expiry_date IS NOT NULL and var_current_expiry_date != "" and var_current_expiry_date < now()) then 
			
			SET var_expiray_date = (CONCAT(DATE_ADD(CURDATE(), INTERVAL 3 MONTH), " 23:59:59"));
			
			UPDATE admin_login 
			SET passwordsInfo = JSON_SET(passwordsInfo, "$.LoginPasswordExpiryDate", var_expiray_date) 
			WHERE empId = var_emp_id;
		end if;
	END$$

CREATE PROCEDURE `update_login_encrypt_data_status`(IN ip_loginEncDecDetailId INT(11), in ip_status tinyint(1))
BEGIN
		UPDATE login_encrypt_details 
		SET `status` = ip_status 
		WHERE `loginEncDecDetailId` = ip_loginEncDecDetailId;
	END$$
DELIMITER ;
