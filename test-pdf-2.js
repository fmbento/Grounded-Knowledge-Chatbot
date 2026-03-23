const { createRequire } = require('module');
const requireESM = createRequire(__filename);
const pdf = requireESM('pdf-parse');
console.log('PDF object type:', typeof pdf);
if (pdf && typeof pdf === 'object') {
  console.log('PDF object keys:', Object.keys(pdf));
  console.log('PDF object default type:', typeof pdf.default);
}
