# 食物数据

> **English summary.** LifeOS ships no food composition table. The China Food Composition Table (6th ed.) is
> copyrighted, so `cn-fct6.json` and `gi.json` are optional reference files that each user may build for
> personal use with `tools/build-food.mjs` and must not redistribute. Without them every tool still works:
> lookups find only your own foods in `custom.json`, unknown composition stays unknown (never zero), and
> `tools/food.mjs` prints a one-line hint pointing here. Any other table you are entitled to use (for example
> a public-domain or openly licensed one) can be converted into the JSON format described below.

| 文件 | 内容 | 来源 |
|---|---|---|
| `cn-fct6.json` | **可选，不随 LifeOS 分发。** 食物成分参考表，每 100g 可食部 | 自行生成，仅限个人使用（见下文） |
| `gi.json` | **可选，不随 LifeOS 分发。** 食物血糖生成指数 | 同上 |
| `custom.json` | 自定义食物：常吃的菜、外卖、包装食品。查询时优先于成分表 | 自己维护 |

## 为什么没有成分表

《中国食物成分表（标准版第 6 版）》原书有版权。LifeOS 不分发由它整理出的数据，`.gitignore` 也排除了这两个文件；自行生成的文件仅限个人使用，请勿提交、上传或再分发。部署工具把它们当作用户自管的参考数据：只在目标库没有时复制过去，从不覆盖，也不会因为源目录里没有而删除目标库里已有的副本。

没有成分表时：

- `node tools/food.mjs search <食物>` 只返回 `custom.json` 中的匹配，并提示本说明的位置；
- `food.mjs calc` 和餐食记录里查不到的食物保持“未知”，合计只给已知小计，绝不按 0 计算；
- `custom.json`、营养素标签录入（按标签数值计算）照常可用。

## 个人使用：生成中国食物成分表

数据整理自 [Sanotsu/china-food-composition-data](https://github.com/Sanotsu/china-food-composition-data)（模型识别 + 人工校对；其版权声明称版权归原作者所有，脚本仅供个人学习研究）。

1. 自行下载该仓库，找到经人工校对、包含 `merged_*.json` 文件的数据目录（目录名以上游仓库为准）；GI 数据为 `json_gi_of_foods/glycemic_index_of_foods.json`。
2. 在 LifeOS 目录运行：

   ```
   node tools/build-food.mjs <merged_*.json 所在目录> [GI json 文件]
   ```

   生成 `data/food/cn-fct6.json` 和（提供 GI 文件时）`data/food/gi.json`。没有找到记录时不会写入任何文件。
3. 已部署的使用库可以直接在库内运行同一命令，或把生成的两个文件复制到库的 `data/food/`。

想把参考表放在库外时，可设置环境变量 `LIFEOS_FOOD_DIR=<目录>`：工具从该目录读取 `cn-fct6.json`/`gi.json`，`build-food.mjs` 也写入该目录；`custom.json` 始终在库内。

历史餐食记录保存当时使用的成分值与文件哈希，安装、更新或删除成分表都不会改写已有记录。

## 参考表 JSON 格式（便于转换其他数据源）

`cn-fct6.json` 是一个数组，每项一种食物，数值均为**每 100g 可食部**；缺失值写 `null`（不要写 0），明确的 0 才写 0：

| 字段 | 含义 | 单位 |
|---|---|---|
| `code` | 唯一编码（字符串），可作为 `food_key` | — |
| `name` | 名称，可作为 `food_key` | — |
| `cat` | 分类（可选） | — |
| `edible` | 可食部比例（可选） | % |
| `kcal` | 能量 | kcal |
| `protein` `fat` `carb` `fiber` | 蛋白质、脂肪、碳水化合物、膳食纤维 | g |
| `Na` `K` `Ca` `Mg` `Fe` `Zn` | 钠、钾、钙、镁、铁、锌 | mg |
| `vitC` `thiamin` `riboflavin` `niacin` | 维生素 C、B1、B2、烟酸 | mg |
| `water` `cholesterol` `vitA` `vitE` `P` `Se` | 其他成分（保留，当前计算未使用） | 按来源 |

```json
[
  { "code": "X0001", "name": "示例食物（煮）", "cat": "示例", "edible": 100, "kcal": 100, "protein": 3, "fat": 0.5,
    "carb": 21, "fiber": 0.4, "Na": 2, "K": null, "Ca": null, "Mg": null, "Fe": null, "Zn": null,
    "vitC": null, "thiamin": null, "riboflavin": null, "niacin": null }
]
```

`gi.json` 是数组：`{ "name": "食物名", "group": "分组", "GI": 数值 }`。

转换其他公开（公有领域或开放许可）成分表时，按上表映射字段与单位，生成同样结构的文件放到 `data/food/`（或 `LIFEOS_FOOD_DIR`）即可，并确认该数据源允许你的使用方式。

## custom.json 格式

数值均为**每 100g**（包装食品按标签换算）。`kcal protein fat carb` 必填，其余可省略。

保留可用的来源类型、来源日期、标签/配方原件、食品生熟状态和可食部说明，可使用 `source_type`、`source_date`、`preparation`、`note` 等字段。未提供的营养素保持为空，明确标为零的参考值与缺失值区分。复用旧条目前核对产品或配方是否变化；历史餐食保留当时使用的成分值和文件哈希，不能因数据更新而自动改写。

`food.mjs calc` 默认要求已核实的精确名称或编码，近似候选不会自动进入计算；确实核查后可显式使用 `--accept-match`。结果同时返回完整已记录合计、已知小计和每项营养素的覆盖情况。菜品份量与配方推断、原图、标签按克/毫升/每份换算的记录流程统一见 `docs/domains/NUTRITION.md`。

```json
[
  { "code": "C001", "name": "食堂宫保鸡丁", "kcal": 180, "protein": 14, "fat": 11, "carb": 7, "fiber": 1, "Na": 600,
    "note": "拆解估算：鸡胸80+花生15+油10+配菜50 /155g", "added": "2026-10-10" }
]
```
