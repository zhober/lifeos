# Quick path for daily records

Meals (text or photos), meal corrections, exercise, sleep, symptoms, weight, mood. This file plus
`AGENTS.md` is enough; every input is documented here, so do not read tool source.

```text
node tools/quick-log.mjs <input.json | -> [--dry-run] [--no-sleep-report]
```

`-` reads JSON from stdin. It archives the verbatim statement, keeps photo originals, writes records,
updates the journal, sums the day and prints one receipt. `--dry-run` previews without writing.
Prefer stdin; if a file is needed, write it under `.lifeos/tmp/`, never in the vault root.

## Dating

- `captured_at` (with offset) defaults to now. 00:00-03:59: "today / 中午 / 晚上" means the day that just ended.
- Sleep goes on the **waking** date. Set `date` only to override; tell the user any `date_notice`.
- `meals[].time` / `exercise[].time` (HH:MM): only times the user stated. A time later than now is refused.

## Examples

```json
{"statement":"中午一碗牛肉面，两百多克面，一个卤蛋。晚上跑步30分钟，膝盖有点疼。昨晚1点睡7点半起。",
 "meals":[{"label":"午餐","components":[
  {"name":"面条（煮）","food_key":"011317","grams":{"low":200,"estimate":250,"high":300},"quote":"两百多克面"},
  {"name":"卤蛋","food_key":"111204","portion_method":"recipe_estimate","grams":{"low":40,"estimate":50,"high":60},
   "assumptions":["1 个，可食部 40-60 g"]}]}],
 "exercise":[{"name":"跑步","duration_min":30}],
 "symptoms":[{"description":"跑步后膝盖有点疼","location":"膝盖（侧别未说明）"}],
 "sleep":{"bed_time":"01:00","wake_time":"07:30"}}
```

Photos (look at each image first; you supply the components) and a sleep screenshot:

```json
{"statement":"早饭和午饭，还有昨晚睡眠截图",
 "meals":[{"label":"早餐","photos":["C:/Users/me/Pictures/b.jpg"],"components":[
  {"name":"包子","food_key":"012101","grams":{"low":120,"estimate":160,"high":200},"assumptions":["两个中等包子"]}]}],
 "attachments":["C:/Users/me/Pictures/s.png"],"sleep":{"bed_time":"00:30","wake_time":"07:30"}}
```

Correction of a saved meal (id from the earlier receipt; give the full new `components`):

```json
{"statement":"包子是猪肉馅，豆浆微甜。","meals":[{"supersedes":"meal-9934a9c4264a6b38ffe1796d","components":[
  {"name":"猪肉包子","food_key":"012101","grams":{"low":120,"estimate":160,"high":200},"assumptions":["两个"]}]}]}
```

## Fields

Top level: `statement` (verbatim, required), `captured_at`, `date`, `meals[]`, `exercise[]`, `symptoms[]`,
`sleep`, `attachments[]`, `weight_kg`, `water_ml` (the user's stated day total; never inferred from cups),
`mood`, `energy`, `stress` (1-5), `study {time, content, min, output}`, `work {h}`.

After saving meals, `node tools/nutrition-gaps.mjs [DATE]` reports the day's remaining protein/carb/fat, fiber, vitamin C and potassium gaps, and suggests one food with gram amount for each real gap (using only foods that carry that number in the composition table; a partial nutrient total is used only as a labelled lower bound). It never treats missing data as zero and never invents an intake.

Photos sent together (one message or a quick burst) show one meal unless the user says otherwise or the photos clearly differ in time or place; record them as one meal's `photos`.

Default to cooked: unless the user says otherwise, everything is already cooked and ready to eat, so use cooked/representative-value entries and never a dry-product entry for a prepared dish. Portion method: anchor each item to a countable reference (one egg, one bun, one bowl of rice, chopstick length, plate diameter), give low/estimate/high and use the middle; user-stated counts and grams override the photo. Choose cooked/edible-weight entries for cooked foods and say which basis you used; avoid dry-product entries for rehydrated foods (dried tofu skin, dried mushrooms, dried noodles) and use serving-weight references (a bowl of rice, one egg, one bun) rather than a bare percentage of the plate.

| Field | Values (default) |
|---|---|
| `components[].grams` | number, `{low, estimate, high}`, or `null` = unknown |
| `components[].portion_method` | `user_reported`, `weighed`, `label_quantity`, `recipe_estimate`, `photo_estimate` (photos), `unknown` |
| `components[].confidence.*` | `identity`/`portion`/`recipe`: `low`/`medium`/`high`/`unknown` |
| `meals[].photos` | image paths (may be outside the vault), or `{path, stage}`: `before`/`after`/`label`/`other` |
| `meals[].supersedes` | meal id to correct; photos, name, time carry over |
| `attachments` | paths, or `{path, kind}`: `sleep` (default), `body`, `health`, `fitness` |
| `exercise[]` | `name`, `duration_min`, `type` (`resistance`/`endurance`/`mobility`/`sport`/`other`), `rpe` 0-10, `title` (e.g. "推类3个动作 3×10") |
| `symptoms[]` | `description`, `location`, `course` (`onset`/`ongoing`/`recurrent`/`resolved`), `severity` 0-10 |
| `sleep` | `bed_time`, `wake_time`, `sleep_h`, `sleep_quality` 1-5, `notes` |

`food_key` must match exactly: `node tools/food.mjs search <food>`. If no entry fits, split the dish into
ingredients or give `grams: null`. Estimates need `assumptions`. Unknown is never zero.

## Reply

1. Confirm what was saved in a few plain lines (no ids, paths or tool steps). Totals cover **recorded**
   items only; never call an unconfirmed day complete. Mention big assumptions with the range.
2. Coach: 1-3 specific suggestions from the receipt `context` (today so far, last 2 days' training,
   sleep, symptoms): what the next meal could add, one tweak for tomorrow ("one more egg at breakfast"),
   protein or recovery after training. Practical, not a lecture.
3. If an unclear item changes the estimate a lot, ask now with 2-4 numbered options; otherwise save
   with a labelled assumption and offer the options in one line.
4. Receipt has a `report`: send its PDF, else the HTML plus the no-PDF reason; never skip it. If that
   date changed since, regenerate via `workflows/report/SKILL.md` first.

## Leave the quick path

Use `workflows/log/SKILL.md` (or `workflows/ask/SKILL.md` for a full plan) when: the user asks for a plan or
comparison; a document needs import; a record must be re-dated, retracted, or a non-meal record corrected;
the work needs several steps or another role; a concerning health or psychological sign; a finance,
shopping, travel or career record; a durable fact worth keeping in memory; or quick-log rejects the input.
