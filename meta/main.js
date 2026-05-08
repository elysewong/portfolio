import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}

function processCommits(data) {
  return d3.groups(data, (d) => d.commit).map(([commit, lines]) => {
    const first = lines[0];
    const { author, date, time, timezone, datetime } = first;

    const ret = {
      id: commit,
      url: 'https://github.com/YOUR_REPO/commit/' + commit,
      author,
      date,
      time,
      timezone,
      datetime,
      hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
      totalLines: lines.length,
    };

    Object.defineProperty(ret, 'lines', {
      value: lines,
      configurable: false,
      writable: false,
      enumerable: false,
    });

    return ret;
  });
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  if (!tooltip) return;
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  if (!tooltip) return;
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
}

function renderCommitInfo(data, commits) {
  const container = d3.select('#stats').append('section').attr('class', 'summary');

  container.append('h2').text('Summary');

  const fileLengths = d3.rollups(
    data,
    (v) => d3.max(v, (d) => d.line),
    (d) => d.file,
  );
  const maxFileLines = d3.max(fileLengths, (d) => d[1]) ?? 0;
  const maxDepth = d3.max(data, (d) => d.depth) ?? 0;
  const longestLineLength = d3.max(data, (d) => d.length) ?? 0;
  const files = d3.group(data, (d) => d.file).size;

  const stats = [
    { label: 'COMMITS', value: commits.length },
    { label: 'FILES', value: files },
    { label: 'TOTAL LOC', value: data.length },
    { label: 'MAX DEPTH', value: maxDepth },
    { label: 'LONGEST LINE', value: longestLineLength },
    { label: 'MAX LINES', value: maxFileLines },
  ];

  const grid = container.append('div').attr('class', 'summary-grid');
  const items = grid.selectAll('.summary-item').data(stats).join('article').attr('class', 'summary-item');

  items.append('p').attr('class', 'summary-label').text((d) => d.label);
  items.append('p').attr('class', 'summary-value').text((d) => d.value);
}

function renderScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;
  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  const margin = { top: 10, right: 10, bottom: 30, left: 20 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
  };

  const xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  const yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  const innerWidth = usableArea.right - usableArea.left;

  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

  const yAxisGrid = d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(() => '');

  const [minRaw, maxRaw] = d3.extent(commits, (d) => d.totalLines);
  const minLines = minRaw ?? 0;
  const maxLines = maxRaw ?? minRaw ?? 1;
  const rScale = d3
    .scaleSqrt()
    .domain(minLines === maxLines ? [minLines, minLines + 1] : [minLines, maxLines])
    .range([2, 30]);

  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  function isCommitSelected(selection, commit) {
    if (!selection) {
      return false;
    }
    const [[x0, y0], [x1, y1]] = selection;
    const cx = xScale(commit.datetime);
    const cy = yScale(commit.hourFrac);
    return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
  }

  function renderSelectionCount(selection) {
    const selectedCommits = selection
      ? commits.filter((d) => isCommitSelected(selection, d))
      : [];

    const countElement = document.querySelector('#selection-count');
    if (countElement) {
      countElement.textContent = `${selectedCommits.length || 'No'} commits selected`;
    }

    return selectedCommits;
  }

  function renderLanguageBreakdown(selection) {
    const selectedCommits = selection
      ? commits.filter((d) => isCommitSelected(selection, d))
      : [];
    const container = document.getElementById('language-breakdown');
    if (!container) return;

    if (selectedCommits.length === 0) {
      container.innerHTML = '';
      return;
    }
    const requiredCommits = selectedCommits.length ? selectedCommits : commits;
    const lines = requiredCommits.flatMap((d) => d.lines);

    const breakdown = d3.rollup(
      lines,
      (v) => v.length,
      (d) => d.type,
    );

    const typeOrder = ['css', 'js', 'html'];
    const entries = Array.from(breakdown, ([language, count]) => ({ language, count }));
    entries.sort((a, b) => {
      const la = String(a.language).toLowerCase();
      const lb = String(b.language).toLowerCase();
      const ia = typeOrder.indexOf(la);
      const ib = typeOrder.indexOf(lb);
      if (ia === -1 && ib === -1) return la.localeCompare(lb);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    container.innerHTML = '';

    for (const { language, count } of entries) {
      const proportion = count / lines.length;
      const formatted = d3.format('.1~%')(proportion);
      const label = String(language).toUpperCase();

      container.innerHTML += `
        <div class="language-column">
          <h3 class="language-name">${label}</h3>
          <p class="language-lines">${count} lines</p>
          <p class="language-pct">(${formatted})</p>
        </div>
      `;
    }
  }

  function brushed(event) {
    const selection = event.selection;
    svg.selectAll('circle').classed('selected', (d) => isCommitSelected(selection, d));
    renderSelectionCount(selection);
    renderLanguageBreakdown(selection);
  }

  const brush = d3
    .brush()
    .extent([
      [usableArea.left, usableArea.top],
      [usableArea.right, usableArea.bottom],
    ])
    .on('start brush end', brushed);

  svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(yAxisGrid)
    .call((g) => g.select('.domain').remove());

  svg.append('g').attr('class', 'brush').call(brush);

  const dots = svg.append('g').attr('class', 'dots');

  dots
    .selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });

  svg
    .append('g')
    .attr('class', 'axis axis-x')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

  svg
    .append('g')
    .attr('class', 'axis axis-y')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(yAxis);

  svg.selectAll('.dots, .overlay ~ *').raise();
}

function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  if (!link || !date || !commit || Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
  });
}
  

let data = await loadData();
let commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);
  