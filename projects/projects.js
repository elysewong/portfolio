import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const titleElement = document.querySelector('.projects-title');
if (projects && Array.isArray(projects)) {
  titleElement.textContent = `${projects.length} Projects`;
} else {
  titleElement.textContent = 'Projects';
}

const searchInput = document.querySelector('.searchBar'); 
let searchQuery = '';
let selectedYear = null;

function projectsMatchingSearch(query) {
  if (!projects || !Array.isArray(projects)) return [];
  const q = query.toLowerCase();
  return projects.filter((project) => {
    const values = Object.values(project).join('\n').toLowerCase();
    return values.includes(q);
  });
}

function renderPieChart(projectsGiven) {
  const newRolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year,
  );
  const newData = newRolledData.map(([year, count]) => ({
    value: count,
    label: year,
  }));

  const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  const newSliceGenerator = d3.pie().value((d) => d.value);
  const newArcData = newSliceGenerator(newData);
  const newArcs = newArcData.map((d) => arcGenerator(d));

  d3.select('#projects-pie-plot').selectAll('path').remove();
  d3.select('.legend').selectAll('li').remove();

  const colors = d3.scaleOrdinal(d3.schemeTableau10);

  newArcs.forEach((arc, idx) => {
    const year = newData[idx].label;
    d3.select('#projects-pie-plot')
      .append('path')
      .attr('d', arc)
      .attr('fill', colors(idx))
      .attr('class', selectedYear !== null && year === selectedYear ? 'selected' : null)
      .style('cursor', 'pointer')
      .on('click', () => {
        selectedYear = selectedYear === year ? null : year;
        syncProjectsView();
      });
  });

  const legend = d3.select('.legend');
  newData.forEach((d, idx) => {
    legend
      .append('li')
      .attr('style', `--color:${colors(idx)}`)
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
  });
}

function syncProjectsView() {
  let list = projectsMatchingSearch(searchQuery);
  renderPieChart(list);
  if (selectedYear !== null) {
    list = list.filter((p) => p.year === selectedYear);
  }
  renderProjects(list, projectsContainer, 'h2');
}

syncProjectsView();

searchInput.addEventListener('change', (event) => {
  searchQuery = event.target.value;
  selectedYear = null;
  syncProjectsView();
});
