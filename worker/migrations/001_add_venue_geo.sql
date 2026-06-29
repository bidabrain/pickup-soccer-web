-- 迁移：为已存在的 matches 表增加可空的场地经纬度列。
-- 向后兼容：已有数据这两列为 NULL（纯文字场地，不显示小地图），现有显示不受影响。
-- 应用方式：npm run db:migrate:local / db:migrate:remote
-- 注意：SQLite 的 ADD COLUMN 不支持 IF NOT EXISTS，本迁移只需执行一次。

ALTER TABLE matches ADD COLUMN venue_lat REAL;
ALTER TABLE matches ADD COLUMN venue_lon REAL;
