SET @add_shift_type_kind_column = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `shift_types` ADD `kind` enum(''day'',''evening'',''night'',''off'',''standby'',''other'') DEFAULT ''other'' NOT NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'shift_types'
    AND COLUMN_NAME = 'kind'
);--> statement-breakpoint
PREPARE add_shift_type_kind_column_stmt FROM @add_shift_type_kind_column;--> statement-breakpoint
EXECUTE add_shift_type_kind_column_stmt;--> statement-breakpoint
DEALLOCATE PREPARE add_shift_type_kind_column_stmt;--> statement-breakpoint
UPDATE `shift_types`
SET `kind` = CASE
  WHEN UPPER(`code`) IN ('D', 'DAY') OR `code` IN ('白', '日') OR `name` IN ('白班', '日班') THEN 'day'
  WHEN UPPER(`code`) IN ('E', 'EVENING') OR `name` IN ('小夜班') THEN 'evening'
  WHEN UPPER(`code`) IN ('N', 'NIGHT') OR `code` IN ('夜') OR `name` IN ('大夜班', '夜班', 'Night Shift') THEN 'night'
  WHEN UPPER(`code`) IN ('OFF', 'REST') OR `code` IN ('休') OR `name` IN ('休息', '休班') THEN 'off'
  WHEN UPPER(`code`) IN ('SB', 'STANDBY') OR `code` IN ('备') OR `name` IN ('备班', '待命') THEN 'standby'
  ELSE `kind`
END;