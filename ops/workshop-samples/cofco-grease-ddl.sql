-- COFCO Grease MVP 样本数据库 DDL（精选 6 张核心表）
-- 来源：cofco_grease_mvp_sample（大宗商品交易数据）
-- 数据覆盖：大豆供需平衡（美/巴/阿）、气象、出口贸易、油粕价格

-- ===== usa_soybean_balance =====
CREATE TABLE `usa_soybean_balance` (
  `date_time` varchar(50) NOT NULL COMMENT '一、关于date_time关于你必须记住的核心信息\n是什么：记录 USDA “大豆月度平衡表报告” 的发布年月，格式固定为 “YYYY-MM”（例：2024-05），只代表报告发布时间，和大豆生长 / 收获时间无关。\n和其他字段的关系：\n跟market_year绑定：1 个market_year（如 2024/2025）最多24个date_time。',
  `market_year` varchar(20) NOT NULL COMMENT '一、关于market_year你必须记住的核心信息\n是什么：唯一标记美国大豆 “种植→收获→销售” 完整周期的时间标识，不是自然年，固定周期是 “每年 5 月至次年 4 月”（例：“2024/2025”=2024 年 5 月 - 2025 年 4 月大豆季）。\n怎么写：三种格式都有效，且后一年 = 前一年 + 1：\n短格式：XX/YY（如 24/25）\n长格式：XXXX/YYYY（如 2024/2025）\n紧凑格式：XXYY（如 2425）\n和其他字段的关系：必须和date_time（报告日期），才能锁定某作物季的具体数据，是时间索引的 “核心锚点”。',
  `market_year_flag` varchar(20) DEFAULT NULL COMMENT '一、你必须记住的核心信息\nmarket_year_flag字段\n取值 1：当年（俗称 “新作”）\n取值 2：往年（俗称 “旧作”）',
  `year` int DEFAULT NULL COMMENT '年标签，是日期标签(date_time)的附属标签，相当于该字段内数值中"-"前面的部分，用于客户独立过滤自然年时候可以方便的使用。',
  `month` int DEFAULT NULL COMMENT '月标签，是日期标签(date_time)的附属标签，相当于该字段内数值中"-"后面的部分，用于客户独立过滤自然月时候可以方便的使用。',
  `beginning_stocks` float DEFAULT NULL COMMENT '期初库存，单位是百万蒲式耳。大豆的转换公式为: 1百万蒲式耳=0.0272百万吨',
  `production` float DEFAULT NULL COMMENT '产量，单位是百万蒲式耳。大豆的转换公式为: 1百万蒲式耳=0.0272百万吨',
  `imports` float DEFAULT NULL COMMENT '进口量，单位是百万蒲式耳。大豆的转换公式为: 1百万蒲式耳=0.0272百万吨',
  `crushings` float DEFAULT NULL COMMENT '压榨量，单位是百万蒲式耳。大豆的转换公式为: 1百万蒲式耳=0.0272百万吨',
  `exports` float DEFAULT NULL COMMENT '出口量，单位是百万蒲式耳。大豆的转换公式为: 1百万蒲式耳=0.0272百万吨',
  `seed_residual` float DEFAULT NULL COMMENT '种用量，单位是百万蒲式耳。大豆的转换公式为: 1百万蒲式耳=0.0272百万吨',
  `ending_stocks` float DEFAULT NULL COMMENT '期末库存，单位是百万蒲式耳。大豆的转换公式为: 1百万蒲式耳=0.0272百万吨',
  `area_planted` float DEFAULT NULL COMMENT '种植面积，单位是（百万英亩）',
  `area_harvested` float DEFAULT NULL COMMENT '收获面积，单位是（百万英亩）',
  `yield_per_harvested_acre` float DEFAULT NULL COMMENT '单产，单位是（蒲式耳/英亩）',
  `stock_sales_ratio` float DEFAULT NULL COMMENT '库销比',
  `main_price` float DEFAULT NULL COMMENT '主力连续价格，单位：（美分/蒲式耳），即CBOT的大豆主连价格（也叫主力价格）。正常来说价格每个交易日都会产生，但在该表中，主力价格同日期字段(date_time)对齐，会按每个月最后一个交易日的收盘价进行记录。方便联合查询',
  `informant` varchar(20) NOT NULL COMMENT '填报人，这个字段是系统维护字段，一般不做暴露和查询。',
  `insert_time` datetime DEFAULT NULL COMMENT '数据更新时间，这个字段是系统维护字段，一般不做暴露和查询。',
  PRIMARY KEY (`date_time`,`market_year`,`informant`)
) ENGINE=InnoDB COLLATE=utf8mb3_bin COMMENT='一、你必须记住的核心信息\n表的定位：这是美国农业部（USDA）按月度发布的官方数据表，核心用途是对美国大豆的 “供需平衡” 情况进行年度预估与核算，数据覆盖大豆从生产（产量）、流通（进口 / 出口）到库存（期初 / 期末）的全链路。\n发布频率与主体：由 USDA 每月固定发布（发布时间参考date_time字段的 “美国时间每月 8-12 日” 规则），每一期报告对应 1 个date_time（报告年月），但单期报告内会包含 “当前作物季预测” 和 “前一作物季核算” 两组数据（需靠market_year_flag区分）。表中数据单位是百万蒲式耳，和吨的转化公式为：1百万蒲式耳=0.0272百万吨\n核心索引字段（3 个必用组合）：这 3 个字段必须一起使用，才能唯一锁定 1 条 “特定报告时间 + 特定作物季 + 特定数据类型” 的记录，是查询的基础：\ndate_time：报告发布年月（定位 “哪一期报告”）\nmarket_year：对应预估的大豆作物季（定位 “哪一个种植 - 销售周期”）\n附属索引字段：用于辅助细化查询，是date_time的拆分字段：\nyear：报告发布年份（如date_time=2024-05则year=2024）\nmonth：报告发布月份（如date_time=2024-05则month=5）\n核心业务指标（8 个关键数据项）：这些是表的核心内容，所有查询最终都围绕这些指标展开，需明确各指标含义：\n期初库存：某一market_year开始时，市场上剩余的大豆库存量\n产量（单位：百万蒲式耳）：该market_year内美国大豆的预计 / 实际总产量\n进口量（单位：百万蒲式耳）：该market_year内美国进口的大豆总量\n压榨量（单位：百万蒲式耳）：该market_year内用于加工压榨（如制豆油、豆粕）的大豆量\n出口量（单位：百万蒲式耳）：该market_year内美国出口的大豆总量\n种用量（单位：百万蒲式耳）：该market_year内用于下一季播种的大豆量\n期末库存（单位：百万蒲式耳）：该market_year结束时，市场上剩余的大豆库存量（供需平衡核心指标）\n库销比：期末库存与该market_year总销售量的比值（反映库存充裕程度）\nmain_price（大豆主力连续价格）：该market_year内大豆主力期货合约的连续价格（反映市场价格走势）\n举例1：如果我问 “2024/2025 作物季大豆的最新产量”：你要先锁定market_year=2024/2025，再对market_year进行分组后选date_time最新的记录，最后提取 “产量” 指标。\n举例2：如果我问 “大豆平衡表中最近5个作物季的产量”：你要先对market_year进行分组后选择date_time最新的记录（注意是分组后选各个组最新的记录，而不是分组后选同一个年月的值），然后从market_year中选出和现在5个最近的值，注意最靠近当前时间的两份报告可能没发布够24份，但也不应抛弃，如2025年提出该问题，那么2025/2026作物季也应该被包含在其中。最后提取 “产量” 指标。\n举例3：如果我问 “2024/2025作物季美国大豆的出口量”：你要先锁定market_year=2024/2025，再对market_year进行分组后，对date_time进行倒序排序，筛选出date_time最新那行数据，然后取 “出口量” 指标。\n举例4:如果我问 “2024/2025 作物季的最新报告”，你要先找market_year=2024/2025，再在这个结果里对date_time排序选择最新的记录。\n举例5：如果我问 “查多年大豆数据”，你要按market_year分组，区分不同年份的作物季（比如 2023/2024、2024/2025 是两个独立组）。\n举例6:如果我没指定要哪个月的报告，你要先对market_year分组（避免同一作物季多份报告重复），再选每个market_year下date_time最新的那 1 份数据。\n举例7：如果我问 “今年美国新作的产量是多少？”，首先筛选year=当年，然后market_year_flag=当年，最后对date_time进行从大到小排序，取date_time最大的那行数据，然后输出“market_year”和“产量”数据\n举例8:如果我问 “今年美国新作的产量是多少？”，首先筛选year=当年，然后market_year_flag=当年，最后对date_time进行从大到小排序，取date_time最大的那行数据，然后输出“market_year”和“产量”数据';

-- ===== brazil_soybean_balance =====
CREATE TABLE `brazil_soybean_balance` (
  `date_time` varchar(50) NOT NULL COMMENT '一、关于date_time关于你必须记住的核心信息\n是什么：记录 USDA “大豆月度平衡表报告” 的发布年月，格式固定为 “YYYY-MM”（例：2024-05），只代表报告发布时间，和大豆生长 / 收获时间无关。\n和其他字段的关系：\n跟market_year绑定：1 个market_year（如 2024/2025）最多24个date_time。\n二、当我问问题时，你该这么用这个字段\n如果我问 “2024/2025 作物季的最新报告”，你要先找market_year=2024/2025，再在这个结果里对date_time排序选择最新的记录。',
  `market_year` varchar(50) NOT NULL COMMENT '一、关于market_year你必须记住的核心信息\n是什么：唯一标记巴西大豆 “种植→收获→销售” 完整周期的时间标识，不是自然年，固定周期是 “每年 5 月至次年 4 月”（例：“2024/2025”=2024 年 5 月 - 2025 年 4 月大豆季）。\n怎么写：三种格式都有效，且后一年 = 前一年 + 1：\n短格式：XX/YY（如 24/25）\n长格式：XXXX/YYYY（如 2024/2025）\n紧凑格式：XXYY（如 2425）\n和其他字段的关系：必须和date_time（报告日期），才能锁定某作物季的具体数据，是时间索引的 “核心锚点”。\n二、当我问问题时，你该这么用这个字段\n如果我问 “查多年大豆数据”，你要按market_year分组，区分不同年份的作物季（比如 2023/2024、2024/2025 是两个独立组）。\n如果我没指定要哪个月的报告，你要先对market_year分组（避免同一作物季多份报告重复），再选每个market_year下date_time最新的那 1 份数据。',
  `market_year_flag` varchar(50) DEFAULT NULL COMMENT '一、关于market_year_flag你必须记住的核心信息\n取值 1：当年（俗称 “新作”）\n取值 2：往年（俗称 “旧作”）\n如果我问 “今年巴西新作的产量是多少？”，首先筛选year=当年，然后market_year_flag=当年，最后对date_time进行从大到小排序，取date_time最大的那行数据，然后输出“market_year”和“产量”数据"',
  `year` int DEFAULT NULL COMMENT '年标签，是日期标签(date_time)的附属标签，相当于该字段内数值中"-"前面的部分，用于客户独立过滤自然年时候可以方便的使用。',
  `month` int DEFAULT NULL COMMENT '月标签，是日期标签(date_time)的附属标签，相当于该字段内数值中"-"后面的部分，用于客户独立过滤自然月时候可以方便的使用。',
  `beginning_stocks` float DEFAULT NULL COMMENT '期初库存，单位：（百万吨）',
  `production` float DEFAULT NULL COMMENT '产量，单位：（百万吨）',
  `imports` float DEFAULT NULL COMMENT '进口量，单位：（百万吨）',
  `crush` float DEFAULT NULL COMMENT '压榨量，单位：（百万吨）',
  `exports` float DEFAULT NULL COMMENT '出口量，单位：（百万吨）',
  `seed_residual` float DEFAULT NULL COMMENT '种用量，单位：（百万吨）',
  `ending_stocks` float DEFAULT NULL COMMENT '期末库存，单位：（百万吨）',
  `stock_sales_ratio` float DEFAULT NULL COMMENT '库销比',
  `main_price` float DEFAULT NULL COMMENT '主力连续价格，单位：（美分/蒲式耳），即CBOT的大豆主连价格（也叫主力价格）。正常来说价格每个交易日都会产生，但在该表中，主力价格同日期字段(date_time)对齐，会按每个月最后一个交易日的收盘价进行记录。方便联合查询',
  `informant` varchar(20) NOT NULL COMMENT '填报人，这个字段是系统维护字段，一般不做暴露和查询。',
  `insert_time` datetime DEFAULT NULL COMMENT '数据更新时间，这个字段是系统维护字段，一般不做暴露和查询。',
  PRIMARY KEY (`date_time`,`market_year`,`informant`)
) ENGINE=InnoDB COLLATE=utf8mb3_bin COMMENT='一、你必须记住的核心信息\n表的定位：这是美国农业部（USDA）按月度发布的官方数据表，核心用途是对巴西大豆的 “供需平衡” 情况进行年度预估与核算，数据覆盖大豆从生产（产量）、流通（进口 / 出口）到库存（期初 / 期末）的全链路。\n发布频率与主体：由 USDA 每月固定发布（发布时间参考date_time字段的 “美国时间每月 8-12 日” 规则），每一期报告对应 1 个date_time（报告年月），但单期报告内会包含 “当前作物季预测” 和 “前一作物季核算” 两组数据（需靠market_year_flag区分）。表中数据单位是百万吨。\n核心索引字段（3 个必用组合）：这 3 个字段必须一起使用，才能唯一锁定 1 条 “特定报告时间 + 特定作物季 + 特定数据类型” 的记录，是查询的基础：\ndate_time：报告发布年月（定位 “哪一期报告”）\nmarket_year：对应预估的大豆作物季（定位 “哪一个种植 - 销售周期”）\nmarket_year_flag：标记是 “当年报告（新作）” 还是 “往年报告（旧作）”\n附属索引字段：用于辅助细化查询，是date_time的拆分字段：\nyear：报告发布年份（如date_time=2024-05则year=2024）\nmonth：报告发布月份（如date_time=2024-05则month=5）\n核心业务指标（8 个关键数据项）：这些是表的核心内容，所有查询最终都围绕这些指标展开，需明确各指标含义：\n期初库存：某一market_year开始时，市场上剩余的大豆库存量\n产量，单位：（百万吨），该market_year内巴西大豆的总产量\n进口量，单位：（百万吨），该market_year内巴西进口的大豆总量\n压榨量，单位：（百万吨），该market_year内用于加工压榨（如制豆油、豆粕）的大豆量\n出口量，单位：（百万吨），该market_year内巴西出口的大豆总量\n种用量，单位：（百万吨），该market_year内用于下一季播种的大豆量\n期末库存，单位：（百万吨），该market_year结束时，市场上剩余的大豆库存量（供需平衡核心指标）\n库销比：期末库存与该market_year总销售量的比值（反映库存充裕程度）\nmain_price（大豆主力连续价格）：该market_year内大豆主力期货合约的连续价格（反映市场价格走势）\n二、当我问问题时，你该这么用这个表\n如果我问 “2024/2025 作物季巴西大豆的最新预估产量”：你要先锁定market_year=2024/2025，再对market_year进行分组后选date_time最新的记录，最后提取 “产量” 指标。\n如果我问 “巴西大豆平衡表中最近5个作物季的产量”：你要先对market_year进行分组后选择date_time最新的记录（注意是分组后选各个组最新的记录，而不是分组后选同一个年月的值），然后从market_year中选出和现在5个最近的值，注意最靠近当前时间的两份报告可能没发布够24分，但也不应抛弃，如2025年提出该问题，那么2025/2026作物季也应该被包含在其中。最后提取 “产量” 指标。';

-- ===== argentina_soybean_balance =====
CREATE TABLE `argentina_soybean_balance` (
  `date_time` varchar(50) NOT NULL COMMENT '一、关于date_time关于你必须记住的核心信息\n是什么：记录 USDA “大豆月度平衡表报告” 的发布年月，格式固定为 “YYYY-MM”（例：2024-05），只代表报告发布时间，和大豆生长 / 收获时间无关。\n和其他字段的关系：\n跟market_year绑定：1 个market_year（如 2024/2025）最多24个date_time。\n二、当我问问题时，你该这么用这个字段\n如果我问 “2024/2025 作物季的最新报告”，你要先找market_year=2024/2025，再在这个结果里对date_time排序选择最新的记录。',
  `market_year` varchar(50) NOT NULL COMMENT '一、关于market_year你必须记住的核心信息\n是什么：唯一标记阿根廷大豆 “种植→收获→销售” 完整周期的时间标识，不是自然年，固定周期是 “每年 5 月至次年 4 月”（例：“2024/2025”=2024 年 5 月 - 2025 年 4 月大豆季）。\n怎么写：三种格式都有效，且后一年 = 前一年 + 1：\n短格式：XX/YY（如 24/25）\n长格式：XXXX/YYYY（如 2024/2025）\n紧凑格式：XXYY（如 2425）\n和其他字段的关系：必须和date_time（报告日期），才能锁定某作物季的具体数据，是时间索引的 “核心锚点”。\n二、当我问问题时，你该这么用这个字段\n如果我问 “查多年大豆数据”，你要按market_year分组，区分不同年份的作物季（比如 2023/2024、2024/2025 是两个独立组）。\n如果我没指定要哪个月的报告，你要先对market_year分组（避免同一作物季多份报告重复），再选每个market_year下date_time最新的那 1 份数据。',
  `market_year_flag` varchar(50) DEFAULT NULL COMMENT '一、关于market_year_flag你必须记住的核心信息\n取值 1：当年（俗称 “新作”）\n取值 2：往年（俗称 “旧作”）\n如果我问 “今年阿根廷新作的产量是多少？”，首先筛选year=当年，然后market_year_flag=当年，最后对date_time进行从大到小排序，取date_time最大的那行数据，然后输出“market_year”和“产量”数据"',
  `year` int DEFAULT NULL COMMENT '年标签，是日期标签(date_time)的附属标签，相当于该字段内数值中"-"前面的部分，用于客户独立过滤自然年时候可以方便的使用。',
  `month` int DEFAULT NULL COMMENT '月标签，是日期标签(date_time)的附属标签，相当于该字段内数值中"-"后面的部分，用于客户独立过滤自然月时候可以方便的使用。',
  `beginning_stocks` float DEFAULT NULL COMMENT '期初库存，单位：（百万吨）',
  `production` float DEFAULT NULL COMMENT '产量，单位：（百万吨）',
  `imports` float DEFAULT NULL COMMENT '进口量，单位：（百万吨）',
  `supply_total` float DEFAULT NULL COMMENT '总供给，无效字段',
  `crush` float DEFAULT NULL COMMENT '压榨量，单位：（百万吨）',
  `exports` float DEFAULT NULL COMMENT '出口量，单位：（百万吨）',
  `seed_residual` float DEFAULT NULL COMMENT '种用量，单位：（百万吨）',
  `ending_stocks` float DEFAULT NULL COMMENT '期末库存，单位：（百万吨）',
  `main_price` float DEFAULT NULL COMMENT '主力连续价格，单位：（美分/蒲式耳），即CBOT的大豆主连价格（也叫主力价格）。正常来说价格每个交易日都会产生，但在该表中，主力价格同日期字段(date_time)对齐，会按每个月最后一个交易日的收盘价进行记录。方便联合查询',
  `stock_sales_ratio` float DEFAULT NULL COMMENT '库销比',
  `informant` varchar(20) NOT NULL COMMENT '填报人，这个字段是系统维护字段，一般不做暴露和查询。',
  `insert_time` datetime DEFAULT NULL COMMENT '数据更新时间，这个字段是系统维护字段，一般不做暴露和查询。',
  PRIMARY KEY (`date_time`,`market_year`,`informant`)
) ENGINE=InnoDB COLLATE=utf8mb3_bin COMMENT='一、你必须记住的核心信息\n表的定位：这是美国农业部（USDA）按月度发布的官方数据表，核心用途是对阿根廷大豆的 “供需平衡” 情况进行年度预估与核算，数据覆盖大豆从生产（产量）、流通（进口 / 出口）到库存（期初 / 期末）的全链路。\n发布频率与主体：由 USDA 每月固定发布（发布时间参考date_time字段的 “美国时间每月 8-12 日” 规则），每一期报告对应 1 个date_time（报告年月），但单期报告内会包含 “当前作物季预测” 和 “前一作物季核算” 两组数据（需靠market_year_flag区分）。表中数据单位是百万吨。\n核心索引字段（3 个必用组合）：这 3 个字段必须一起使用，才能唯一锁定 1 条 “特定报告时间 + 特定作物季 + 特定数据类型” 的记录，是查询的基础：\ndate_time：报告发布年月（定位 “哪一期报告”）\nmarket_year：对应预估的大豆作物季（定位 “哪一个种植 - 销售周期”）\nmarket_year_flag：标记是 “当年报告（新作）” 还是 “往年报告（旧作）”\n附属索引字段：用于辅助细化查询，是date_time的拆分字段：\nyear：报告发布年份（如date_time=2024-05则year=2024）\nmonth：报告发布月份（如date_time=2024-05则month=5）\n核心业务指标（8 个关键数据项）：这些是表的核心内容，所有查询最终都围绕这些指标展开，需明确各指标含义：\n期初库存：某一market_year开始时，市场上剩余的大豆库存量\n产量，单位：（百万吨），该market_year内阿根廷大豆的总产量\n进口量，单位：（百万吨），该market_year内阿根廷进口的大豆总量\n压榨量，单位：（百万吨），该market_year内用于加工压榨（如制豆油、豆粕）的大豆量\n出口量，单位：（百万吨），该market_year内阿根廷出口的大豆总量\n种用量，单位：（百万吨），该market_year内用于下一季播种的大豆量\n期末库存，单位：（百万吨），该market_year结束时，市场上剩余的大豆库存量（供需平衡核心指标）\n库销比：期末库存与该market_year总销售量的比值（反映库存充裕程度）\nmain_price（大豆主力连续价格）：该market_year内大豆主力期货合约的连续价格（反映市场价格走势）\n二、当我问问题时，你该这么用这个表\n如果我问 “2024/2025 作物季阿根廷大豆的最新产量”：你要先锁定market_year=2024/2025，再对market_year进行分组后选date_time最新的记录，最后提取 “产量” 指标。\n如果我问 “阿根廷大豆平衡表中最近5个作物季的产量”：你要先对market_year进行分组后选择date_time最新的记录（注意是分组后选各个组最新的记录，而不是分组后选同一个年月的值），然后从market_year中选出和现在5个最近的值，注意最靠近当前时间的两份报告可能没发布够24份，但也不应抛弃，如2025年提出该问题，那么2025/2026作物季也应该被包含在其中。最后提取 “产量” 指标。';

-- ===== usa_weekly_export_detail =====
CREATE TABLE `usa_weekly_export_detail` (
  `t_date` datetime NOT NULL COMMENT '记录 USDA “usa_weekly_export_detail” 的发布具体时间；',
  `country` varchar(50) NOT NULL COMMENT '美国出口的目的地国家及地区；\n举例1:中国=“CHINA, PEOPLES REPUBLIC OF”，输出中国的数据需要明确说明是否包含台湾的数据。除非特别说明则不需要累加台湾的量\n举例2:如果我问“24/25作物季美国大豆出口全球总成交量是多少？”你需要通过筛选country=GRAND TOTAL来获取总量数据；\n举例3:需要排除“KNOWN”与“UNKNOWN”的数据，不参与排序；',
  `commodity` varchar(50) NOT NULL COMMENT '商品\n举例6:如果我问豆粕，则commodity=‘Soybean cake & meal’，如果我问豆油，则commodity=‘Soybean Oil’，如果我问大豆则commodity=‘Soybean‘',
  `crop_year` varchar(50) NOT NULL COMMENT '一、关于crop_year（作物年、作物季）你必须记住的核心信息\n是什么：唯一标记美国大豆 “种植→收获→销售” 完整周期的时间标识，不是自然年，固定周期是 “每年 5 月至次年 4 月”（例：“2024/2025”=2024 年 5 月 - 2025 年 4 月大豆季）。\n怎么写：三种格式都有效，且后一年 = 前一年 + 1：\n短格式：XX/YY（如 24/25）\n长格式：XXXX/YYYY（如 2024/2025）\n紧凑格式：XXYY（如 2425）',
  `weekly` int NOT NULL COMMENT '周',
  `weekly_exports` bigint DEFAULT NULL COMMENT '周度出口装船吨数，单位是(吨)，大豆的转换公式为: 1吨=36.7437蒲式耳',
  `accum_exports` bigint DEFAULT NULL COMMENT '累计出口装船吨数，单位是(吨)；大豆的转换公式为: 1吨=36.7437蒲式耳\n举例1：如果我问 “25/26作物季美国对阿根廷大豆累计出口装船量是多少？”：Country=''阿根廷''，Commodity 等于 ''Soybeans''，报告日期 t_date 在，corp_year=2025/2026，对 t_date进行排序，取对应最新日期对应的取accum_exports数据，作为阿根廷大豆累计出口装船量；',
  `outstanding_sales` bigint DEFAULT NULL COMMENT '未装船吨数（已售未发量），单位是(吨)，大豆的转换公式为: 1吨=36.7437蒲式耳\n总销售量=未装船量+累计出口装船量',
  `gross_sales` bigint DEFAULT NULL COMMENT '次字段为废弃字段不要参与任何计算',
  `net_sales` bigint DEFAULT NULL COMMENT '当周净销售吨数（当周成交量），单位是(吨)，大豆的转换公式为: 1吨=36.7437蒲式耳',
  `total_commitments` bigint DEFAULT NULL COMMENT '总成交吨数/总销售吨数，单位是(吨)，大豆的转换公式为: 1吨=36.7437蒲式耳',
  `nmy_outstanding_sales` bigint DEFAULT NULL COMMENT '下一年度未装船吨数，单位是(吨)，大豆的转换公式为: 1吨=36.7437蒲式耳',
  `nmy_net_suales` bigint DEFAULT NULL COMMENT '下一年度当周净销售吨数，单位是(吨)； 1吨=36.7437蒲式耳',
  `unit` varchar(255) DEFAULT NULL COMMENT '单位',
  `update_time` datetime DEFAULT NULL COMMENT '数据更新时间',
  PRIMARY KEY (`t_date`,`country`,`commodity`,`crop_year`,`weekly`)
) ENGINE=InnoDB COLLATE=utf8mb3_bin COMMENT='此表涉及数量单位均为(吨)；  此表如果和(usa_soybean_balance)表联合查询，注意要把(usa_soybean_balance)查询结果中的单位从蒲式耳统一转换为吨后再计算，1吨=36.7437蒲式耳。\n例1：销售进度=总成交吨数/出口量，出口量的单位是（百万蒲式耳），这里需要转化为（吨） 即出口量*1000000/36.7437\n统计过程中需要剔除 国家=“UNKMNOW”；';

-- ===== usa_oil_meal_price_cost =====
CREATE TABLE `usa_oil_meal_price_cost` (
  `date_time` datetime NOT NULL COMMENT '一、关于date_time关于你必须记住的核心信息\n是什么：记录 USDA “榨利报告” 的发布年月，格式固定为 “YYYY-MM”（例：2024-05），只代表报告发布时间。',
  `margin` float DEFAULT NULL COMMENT '榨利，单位是美元/吨',
  `margin_year_ago` float DEFAULT NULL COMMENT '去年同期，单位美元/吨',
  `five_year_avg_margin` float DEFAULT NULL COMMENT '五年平均，单位美元/吨',
  `informant` varchar(20) NOT NULL COMMENT '填报人',
  `insert_time` datetime DEFAULT NULL COMMENT '数据插入更新时间',
  PRIMARY KEY (`date_time`,`informant`)
) ENGINE=InnoDB COLLATE=utf8mb3_bin;

-- ===== usa_weather_precipitation =====
CREATE TABLE `usa_weather_precipitation` (
  `date_time` datetime NOT NULL COMMENT '日期',
  `state` varchar(50) NOT NULL COMMENT '地区',
  `alias` varchar(50) DEFAULT NULL COMMENT '别名',
  `weekly` int DEFAULT NULL COMMENT '周',
  `year` varchar(255) DEFAULT NULL COMMENT '年',
  `precipitation` float DEFAULT NULL COMMENT '降水量',
  `five_year_avg_precipitation` float DEFAULT NULL COMMENT '降水量 5年平均',
  `year_avg_30_precipitation` float DEFAULT NULL COMMENT '降水量 30年平均',
  `precipitation_10_year_ago` float DEFAULT NULL COMMENT '10年前降水量',
  `precipitation_30_year_min` float DEFAULT NULL COMMENT '历史区间最小（30年）',
  `precipitation_30_year_max` float DEFAULT NULL COMMENT '历史区间最大（30年）',
  `informant` varchar(20) DEFAULT NULL COMMENT '填报人',
  `insert_time` datetime DEFAULT NULL COMMENT '数据插入更新时间',
  PRIMARY KEY (`date_time`,`state`)
) ENGINE=InnoDB COLLATE=utf8mb3_bin;
