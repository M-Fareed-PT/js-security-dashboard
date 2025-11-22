// security-dashboard/app.js
// Module script — loads a JSON file and displays summary and charts using Chart.js

const fileInput = document.getElementById('fileInput');
const loadSample = document.getElementById('loadSample');
const summaryEl = document.getElementById('summary');
const rawJsonEl = document.getElementById('rawJson');

let portChart, statusChart;

fileInput.addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const text = await f.text();
  const json = JSON.parse(text);
  renderFromJson(json);
});

loadSample.addEventListener('click', async () => {
  const res = await fetch('examples/results.json');
  const json = await res.json();
  renderFromJson(json);
});

function renderFromJson(j) {
  rawJsonEl.textContent = JSON.stringify(j, null, 2).slice(0, 5000);
  // sample support for both portscanner and recon outputs
  // If it's portscanner style: j.results array of {port, open, banner}
  if (j.results && Array.isArray(j.results)) {
    renderPortScanner(j);
    return;
  }
  // If recon-style (domain, http, subdomains)
  if (j.domain) {
    renderRecon(j);
    return;
  }
  // fallback: just show keys
  summaryEl.innerHTML = `<div class="card">Unknown JSON structure. Keys: ${Object.keys(j).join(', ')}</div>`;
}

function renderPortScanner(j) {
  const open = j.results.filter(r => r.open);
  const closed = j.results.filter(r => !r.open);
  summaryEl.innerHTML = `
    <div class="card"><strong>Target</strong><div>${j.target}</div></div>
    <div class="card"><strong>Open ports</strong><div>${open.length}</div></div>
    <div class="card"><strong>Total ports scanned</strong><div>${j.results.length}</div></div>
  `;
  // build port chart dataset (open vs closed)
  const labels = ['Open','Closed'];
  const data = [open.length, closed.length];

  const ctx1 = document.getElementById('portChart').getContext('2d');
  if (portChart) portChart.destroy();
  portChart = new Chart(ctx1, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: ['#06b6d4','#334155'] }] },
    options: { responsive:true }
  });

  // status classes (if present)
  const statusCounts = {};
  for (const r of j.results) {
    const s = r.status || (r.open ? 'open' : 'closed');
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }
  const labels2 = Object.keys(statusCounts);
  const data2 = Object.values(statusCounts);
  const ctx2 = document.getElementById('statusChart').getContext('2d');
  if (statusChart) statusChart.destroy();
  statusChart = new Chart(ctx2, {
    type: 'bar',
    data: { labels: labels2, datasets: [{ label: 'Count', data: data2, backgroundColor: '#0ea5e9' }] },
    options: { responsive:true, scales:{ y:{ beginAtZero:true } } }
  });
}

function renderRecon(j) {
  summaryEl.innerHTML = `
    <div class="card"><strong>Domain</strong><div>${j.domain}</div></div>
    <div class="card"><strong>HTTP status</strong><div>${j.http?.status ?? 'n/a'}</div></div>
    <div class="card"><strong>Resolved A</strong><div>${(j.dns && j.dns.a) ? j.dns.a.join(', ') : 'n/a'}</div></div>
    <div class="card"><strong>Detected Tech</strong><div>${(j.tech && j.tech.length) ? j.tech.join(', ') : 'none'}</div></div>
  `;

  // port chart placeholder (no ports in recon) — show subdomain count
  const labels = ['Subdomains found','Subdomains tested'];
  const found = (j.subdomains && j.subdomains.length) ? j.subdomains.length : 0;
  const tested = found ? found : 0;
  const ctx1 = document.getElementById('portChart').getContext('2d');
  if (portChart) portChart.destroy();
  portChart = new Chart(ctx1, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: [found, SUBTOTAL(tested, found)], backgroundColor: ['#06b6d4','#334155'] }] },
    options: { responsive:true }
  });

  // status chart: show nothing for recon, show tech distribution instead
  const tech = j.tech && j.tech.length ? j.tech : ['none'];
  const labels2 = tech;
  const data2 = tech.map(() => 1);
  const ctx2 = document.getElementById('statusChart').getContext('2d');
  if (statusChart) statusChart.destroy();
  statusChart = new Chart(ctx2, {
    type: 'bar',
    data: { labels: labels2, datasets: [{ label: 'Count', data: data2, backgroundColor: '#0ea5e9' }] },
    options: { responsive:true, scales:{ y:{ beginAtZero:true } } }
  });
}

function SUBTOTAL(total, found) {
  // helper to compute remaining tested
  return Math.max(0, total - found);
}
