/* Shared form options for signup and profile forms */

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia','Austria','Azerbaijan',
  'Bahrain','Bangladesh','Belarus','Belgium','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria',
  'Cambodia','Cameroon','Canada','Chad','Chile','China','Colombia','Comoros','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic',
  'Denmark','Djibouti','Dominican Republic',
  'Ecuador','Egypt','El Salvador','Estonia','Ethiopia',
  'Fiji','Finland','France',
  'Georgia','Germany','Ghana','Greece','Guatemala',
  'Honduras','Hong Kong','Hungary',
  'Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Ivory Coast',
  'Jamaica','Japan','Jordan',
  'Kazakhstan','Kenya','Kuwait','Kyrgyzstan',
  'Laos','Latvia','Lebanon','Libya','Liechtenstein','Lithuania','Luxembourg',
  'Macau','Madagascar','Malaysia','Maldives','Mali','Malta','Mauritius','Mexico','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar',
  'Namibia','Nepal','Netherlands','New Zealand','Nigeria','North Macedonia','Norway',
  'Oman',
  'Pakistan','Palestine','Panama','Paraguay','Peru','Philippines','Poland','Portugal',
  'Qatar',
  'Romania','Russia','Rwanda',
  'Saudi Arabia','Senegal','Serbia','Seychelles','Singapore','Slovakia','Slovenia','Somalia','South Africa','South Korea','Spain','Sri Lanka','Sudan','Sweden','Switzerland','Syria',
  'Taiwan','Tajikistan','Tanzania','Thailand','Tunisia','Turkey','Turkmenistan',
  'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan',
  'Venezuela','Vietnam',
  'Yemen',
  'Zambia','Zimbabwe'
];

const SPECIALTIES = [
  'Luxury','Family','MICE','Beach','Adventure','Wellness & Spa','Cultural & Heritage',
  'Eco-Tourism','City Breaks','Honeymoon & Romance','Golf','Diving & Water Sports',
  'Desert Experiences','Cruise','Ski & Mountain','Safari','Food & Wine','Business Travel',
  'Budget','Boutique','All-Inclusive','Long Stay','Group Travel'
];

const TARGET_MARKETS = [
  'United Arab Emirates','Saudi Arabia','Qatar','Bahrain','Oman','Kuwait',
  'United Kingdom','Germany','France','Italy','Spain','Netherlands','Switzerland','Russia',
  'India','China','Japan','South Korea','Australia',
  'United States','Canada','Brazil',
  'South Africa','Nigeria','Kenya',
  'Thailand','Malaysia','Singapore','Indonesia','Philippines'
];

/** Render a country <select> */
function renderCountrySelect(name, selected, required) {
  return `<select name="${name}" ${required ? 'required' : ''}>
    <option value="">Select country</option>
    ${COUNTRIES.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('')}
  </select>`;
}

/** Render a multi-select tag picker */
function renderTagPicker(id, options, selected) {
  selected = selected || [];
  return `
    <div class="tag-picker" id="${id}">
      <div class="tag-picker-selected" id="${id}-selected">
        ${selected.map(s => `<span class="tag-chip">${s}<button type="button" onclick="removeTag('${id}','${s}')">&times;</button></span>`).join('')}
      </div>
      <select onchange="addTag('${id}', this)" style="margin-top:6px">
        <option value="">Add...</option>
        ${options.map(o => `<option value="${o}" ${selected.includes(o) ? 'disabled' : ''}>${o}</option>`).join('')}
      </select>
      <input type="hidden" name="${id}" id="${id}-value" value="${selected.join(', ')}">
    </div>`;
}

function addTag(pickerId, selectEl) {
  const val = selectEl.value;
  if (!val) return;
  const container = document.getElementById(pickerId + '-selected');
  const hidden = document.getElementById(pickerId + '-value');
  const current = hidden.value ? hidden.value.split(', ').filter(Boolean) : [];
  if (current.includes(val)) { selectEl.value = ''; return; }
  current.push(val);
  hidden.value = current.join(', ');
  container.insertAdjacentHTML('beforeend',
    `<span class="tag-chip">${val}<button type="button" onclick="removeTag('${pickerId}','${val}')">&times;</button></span>`);
  selectEl.querySelector(`option[value="${val}"]`).disabled = true;
  selectEl.value = '';
}

function removeTag(pickerId, val) {
  const hidden = document.getElementById(pickerId + '-value');
  const current = hidden.value.split(', ').filter(Boolean);
  hidden.value = current.filter(v => v !== val).join(', ');
  const container = document.getElementById(pickerId + '-selected');
  container.querySelectorAll('.tag-chip').forEach(chip => {
    if (chip.textContent.replace('\u00d7', '').trim() === val) chip.remove();
  });
  const select = document.getElementById(pickerId).querySelector('select');
  const opt = select.querySelector(`option[value="${val}"]`);
  if (opt) opt.disabled = false;
}
