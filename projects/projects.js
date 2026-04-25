import { fetchJSON, renderProjects } from '../global.js';
const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const titleElement = document.querySelector('.projects-title');
if (projects && Array.isArray(projects)) {
  titleElement.textContent = `${projects.length} Projects`;
} else {
  titleElement.textContent = 'Projects';
}
renderProjects(projects, projectsContainer, 'h2');