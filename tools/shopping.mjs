// File-based shopping facade. No retailer API, browser automation, timer or checkout.
import { inputJSON } from './store.mjs';
import { ensure } from './record-data.mjs';
import { retainShoppingOriginal, recordShopping, shoppingRecords, shoppingRecordView, shoppingTimeline } from './shopping-data.mjs';
import { offerPrice, compareOffers, shoppingProduct, shoppingQueue } from './shopping-report.mjs';
const [command, argument, ...rest] = process.argv.slice(2), args = [argument, ...rest];
const option = name => { const i = args.indexOf('--' + name); return i < 0 ? undefined : args[i + 1]; };
try {
  let result;
  if (command === 'original') result = retainShoppingOriginal(inputJSON(argument));
  else if (command === 'record') result = recordShopping(inputJSON(argument));
  else if (command === 'show' || command === 'price') { const c = shoppingRecords(), r = c.current.find(x => x.record_id === argument) ?? c.all.find(x => x.file === argument); ensure(r, 'Unknown shopping record.'); ensure(command !== 'price' || r.kind === 'offer', 'Price requires an offer.'); result = command === 'price' ? offerPrice(r, c) : shoppingRecordView(r, c); }
  else if (command === 'timeline') result = shoppingTimeline({ subject: option('subject'), kind: option('kind'), product_ref: option('product'), from: option('from'), to: option('to'), history: args.includes('--history') });
  else if (command === 'compare') { const i = inputJSON(argument); result = compareOffers(i.offer_paths, { at: i.at, now: i.now }); }
  else if (command === 'product') result = shoppingProduct(argument, { at: option('at'), now: option('now'), subject: option('subject') });
  else if (command === 'queue') result = shoppingQueue({ at: option('at'), now: option('now'), subject: option('subject') });
  else throw new Error('Usage: shopping.mjs original|record|compare INPUT_JSON | show|price ID_OR_PATH | product ID_OR_PATH [--at DATE --subject ID] | timeline [--subject ID --kind KIND --product PATH --from DATE --to DATE --history] | queue [--at DATE --subject ID]');
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
