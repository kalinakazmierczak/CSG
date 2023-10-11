import * as d3 from 'd3';
import { Contributor, ContributionName } from '../src/hidden_figures_types';

type ContributionNameFromAPI = Omit<ContributionName, 'contribution'>;

export type DataPoint = {
  id: string;
  contributor?: Contributor;
  contribution_name?: ContributionNameFromAPI;
};

type Link = {
  target: string;
  source: string; //how we want to uniquely identify the contributor node, we want this map to contributor_xx(id)
  strength: number;
};

export function makeConnectionsChart(
  graph: HTMLDivElement,
  contributionNameData: ContributionName[],
  setSelectedNode: (d: DataPoint | null) => void,
) {
  const contributionArray: DataPoint[] = [];
  for (const contribution_name of contributionNameData) {
    contributionArray.push({
      id: contribution_name.name,
      contribution_name: contribution_name,
    });
  }

  const links: Link[] = [];
  const contributors: { [key: string]: Contributor } = {};

  // Iterate through combinedData
  contributionNameData.forEach((obj) => {
    for (const contribution of obj.contribution) {
      links.push({
        //try to uniquely identify based on contribution name
        target: obj.name, //how we want to uniquely identify the contribution node, CONTRIBUTION
        source: contribution.contributor.name, //how we want to uniquely identify the contributor node, we want this map to contributor_xx(id)
        strength: 1,
      });
      contributors[contribution.contributor.name] = contribution.contributor;
    }
  });
  const contributorNodes: DataPoint[] = [];
  Object.values(contributors).forEach((obj) =>
    contributorNodes.push({
      id: obj.name, //we want this to be the source
      contributor: obj,
    }),
  );

  const modelData = contributorNodes.concat(contributionArray);

  const s = d3
    .select(graph)
    .append('svg')
    .attr('width', '100%') // 100%
    .attr('height', '100%') // 100%
    .append('g');

  // Create the simulation
  const simulation = d3
    .forceSimulation(modelData)
    .force('charge', d3.forceManyBody().strength(-500))
    .force('center', d3.forceCenter(500, 400))
    .force('collide', d3.forceCollide(100)); //might change later

  //setting up the nodes
  //issue

  simulation.force(
    'link',
    d3.forceLink(links).id(function (d: DataPoint) {
      return d.id;
    }),
  );

  const linkElements = s
    .append('g')
    .selectAll('line')
    .data(links)
    .enter()
    .append('line')
    .attr('stroke-width', 3)
    .attr('stroke', '#E5E5E5')
    .attr('marker-end', 'url(#end)');

  const nodeElements = s
    .append('g')
    .selectAll('g')
    .data(modelData) // Use the combined data (modelData) here
    .enter()
    .append('g');

  nodeElements
    .style('cursor', 'pointer')
    .append('image')
    .attr(
      'xlink:href',
      (d: DataPoint) =>
        d.contributor?.image?.file_name ||
        d.contribution_name?.image?.file_name ||
        'unknown',
    )

    .attr('x', (d: DataPoint) => (d.contributor ? -20 : -40))
    .attr('y', (d: DataPoint) => (d.contributor ? -20 : -40))
    .attr('width', (d: DataPoint) => (d.contributor ? 40 : 80))
    .attr('height', (d: DataPoint) => (d.contributor ? 40 : 80));

  //make it circular
  nodeElements.selectAll('image').style('clip-path', 'url(#circle-clip)');

  s.append('defs')
    .append('clipPath')
    .attr('id', 'circle-clip')
    .append('circle')
    .attr('cx', 0)
    .attr('cy', 0)
    .attr('r', 30);

  const textElements = s
    .append('g')
    .selectAll('text')
    .data(modelData)
    .enter()
    .append('text')
    .text(function (d: DataPoint) {
      return d.contributor ? d.contributor.name : d.id;
    })
    .attr('font-size', function (d: DataPoint) {
      return d.contributor ? 15 : d.contribution_name ? 17 : 0;
    })
    .attr('font-weight', function (d: DataPoint) {
      return d.contribution_name ? 'bold' : 'normal';
    })
    .attr('dx', function (d: DataPoint) {
      return d.contributor ? 15 : d.contribution_name ? 40 : 15;
    })
    .attr('dy', function (d) {
      return d.level === 'contributor'
        ? 4
        : d.level === 'contribution'
        ? 11
        : 0;
    });

  //gets everything to show up
  simulation.nodes(modelData).on('tick', () => {
    // Position the node elements (contributors and contributions)
    nodeElements.attr('transform', (d) => `translate(${d.x},${d.y})`);

    // Position the text labels
    textElements.attr('x', (d) => d.x).attr('y', (d) => d.y);

    // Update the position of the link elements
    linkElements
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);
  });

  //checks if a node and another node are neighbors
  function isNeighborLink(node: DataPoint, link) {
    return link.target.id === node.id || link.source.id === node.id;
  }

  function getLinkColor(node: DataPoint, link) {
    return isNeighborLink(node, link) ? 'green' : '#E5E5E5';
  }

  //selects a node and changes the colors of the paths if nodes are neighbors
  function selectNode(selectedNode: DataPoint) {
    // const neighbors = getNeighbors(selectedNode);
    linkElements.attr('stroke', (link: Link) =>
      getLinkColor(selectedNode, link),
    );
    setSelectedNode(selectedNode);
    resetInteractionTimer();
  }

  let interactionTimer; // Variable to store the timer

  // Function to reset the interaction timer
  function resetInteractionTimer() {
    clearTimeout(interactionTimer); // Clear the previous timer
    interactionTimer = setTimeout(
      () => {
        callRecenter();
        setSelectedNode(null);
      },
      3 * 60 * 1000,
    ); // 3 minutes (3 * 60 seconds) * 1000 milliseconds
  }

  nodeElements.on('click', selectNode);

  const zoomBehavior = d3.zoom().on('zoom', handleZoom).scaleExtent([0.1, 3]);

  function handleZoom() {
    s.attr('transform', d3.event.transform);
    resetInteractionTimer();
  }
  function initZoom() {
    d3.select('svg').call(zoomBehavior);
  }

  initZoom();

  function callRecenter() {
    d3.select('svg')
      .transition()
      .call(zoomBehavior.transform, d3.zoomIdentity.scale(0.5));
  }

  return {
    zoomin: () => {
      d3.select('svg').transition().call(zoomBehavior.scaleBy, 1.3);
      resetInteractionTimer();
    },
    zoomout: () => {
      d3.select('svg').transition().call(zoomBehavior.scaleBy, 0.7);
      resetInteractionTimer();
    },
    recenter: () => {
      callRecenter();
      resetInteractionTimer();
    },
    panToContribution: (contributionName: string) => {
      const targetNode = modelData.find((node) => node.id === contributionName);
      if (targetNode && 'x' in targetNode && 'y' in targetNode) {
        const transform = d3.zoomIdentity.translate(
          -(targetNode.x as number) + graph.clientWidth / 2,
          -(targetNode.y as number) + graph.clientHeight / 2,
        );
        d3.select('svg').transition().call(zoomBehavior.transform, transform);
      }
      resetInteractionTimer();
      if (targetNode) {
        selectNode(targetNode);
      }
    },
  };
}
