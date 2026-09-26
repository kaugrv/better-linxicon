import chroma from "chroma-js";
import Graph from "graphology";
import ForceSupervisor from "graphology-layout-force/worker";
import Sigma from "sigma";



async function getData() {
  const url = "http://ardabox.freeboxos.fr:49201/words";
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    const result = await response.json();
    console.log(result);
    return result;

  } catch (error) {
    console.error(error.message);
  }
}
let words = [];

getData().then( (data) => {

let firstWord1 = data.words[0];
let firstWord2 = data.words[1];

words.push(firstWord1);
words.push(firstWord2);

graph.addNode(firstWord1, { label: firstWord1, x: 0, y: 0, size: 10, color: "#000" });
graph.addNode(firstWord2, { label: firstWord2, x: -5, y: 5, size: 10,  color: "#000"  });

});


const graph = new Graph();

export function addWord() {
  let newWord = document.getElementById("input-word").value;
  words.push(newWord);
  console.log(words);

    // We create a new node
    const node = {
     x: 0, y:0,
      size: 10,
      color: chroma.random().hex(),
    };

    // Searching the two closest nodes to auto-create an edge to it
    const closestNodes = graph
      .nodes()
      .map((nodeId) => {
        const attrs = graph.getNodeAttributes(nodeId);
        const distance = Math.pow(node.x - attrs.x, 2) + Math.pow(node.y - attrs.y, 2);
        return { nodeId, distance };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2);

    // We register the new node into graphology instance
    graph.addNode(newWord, { label: newWord, x: 5, y: 0, size: 10, color: "#000" });

    // We create the edges
    closestNodes.forEach((e) => graph.addEdge(newWord, e.nodeId));

}

export function main () {
  // Retrieve the html document for sigma container
  const container = document.getElementById("sigma-container");

  // Create a sample graph

  // Create the spring layout and start it
  const layout = new ForceSupervisor(graph, { isNodeFixed: (_, attr) => attr.highlighted });
  layout.start();

  // Create the sigma
  const renderer = new Sigma(graph, container, { minCameraRatio: 0.5, maxCameraRatio: 2, height: "1080px", autoRescale: true,
   });

  // State for drag'n'drop
  let draggedNode = null;
  let isDragging = false;

  renderer.on("downNode", (e) => {
    isDragging = true;
    draggedNode = e.node;
    graph.setNodeAttribute(draggedNode, "highlighted", true);
    if (!renderer.getCustomBBox()) renderer.setCustomBBox(renderer.getBBox());
  });

  // On mouse move, if the drag mode is enabled, we change the position of the draggedNode
  renderer.on("moveBody", ({ event }) => {
    if (!isDragging || !draggedNode) return;

    // Get new position of node
    const pos = renderer.viewportToGraph(event);

    graph.setNodeAttribute(draggedNode, "x", pos.x);
    graph.setNodeAttribute(draggedNode, "y", pos.y);

    // Prevent sigma to move camera:
    event.preventSigmaDefault();
    event.original.preventDefault();
    event.original.stopPropagation();
  });

  // On mouse up, we reset the dragging mode
  const handleUp = () => {
    if (draggedNode) {
      graph.removeNodeAttribute(draggedNode, "highlighted");
    }
    isDragging = false;
    draggedNode = null;
  };
  renderer.on("upNode", handleUp);
  renderer.on("upStage", handleUp);

  return () => {
    renderer.kill();
  };
};