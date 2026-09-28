import chroma from "chroma-js";
import Graph from "graphology";
import ForceSupervisor from "graphology-layout-force/worker";
import Sigma from "sigma";

const API_URL = "http://ardabox.freeboxos.fr:49201";
const SIM_THRESH = 0.33;

// Compact impl. below from https://stackoverflow.com/questions/64816766/dot-product-of-two-arrays-in-javascript
const dot = (a, b) => a.map((x, i) => a[i] * b[i]).reduce((m, n) => m + n);

async function getFirstWords() {
    const url = `${API_URL}/words`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error(error.message);
    }
}

async function getEmbed(word) {
    const url = `${API_URL}/embd/${word}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(
                `Failed to fetch word embedding. Response status: ${response.status}`,
            );
        }

        const embd = await response.json();
        return embd;
    } catch (error) {
        console.error(error.message);
    }
}

let wordEmbds = {};
let loader = document.querySelector(".loader");

function checkSimilarityWithWords(newWord, newEmbd) {
    Object.entries(wordEmbds).forEach((entry) => {
        const [word, wordEmbd] = entry;
        let sim = dot(wordEmbd, newEmbd);
        sim = Math.max(0, sim);

        // Re-balance the similarities: `SIM_THRESH` is the "50%" value
        if (sim < SIM_THRESH) {
            sim = (sim / SIM_THRESH) * 0.5;
        } else {
            sim = ((sim - SIM_THRESH) / (1 - SIM_THRESH)) * 0.5 + 0.5;
        }

        if (sim >= 0.5) {
            graph.addEdge(newWord, word);
            loader.style.display = "none";
        }
    });
}

const graph = new Graph();

export function addWord() {
    loader.style.display = "flex";

    let newWord = document.getElementById("input-word").value;

    if (newWord in wordEmbds) {
        alert("Mot déjà présent:", newWord);
        loader.style.display = "none";
    }

    getEmbed(newWord)
        .then((embd) => {
            if (embd === null) {
                alert(
                    "Ce mot n'est pas présent dans le dictionnaire:",
                    newWord,
                );
                return;
            }

            // Embd existsWe register the new node into graphology instance
            graph.addNode(newWord, {
                label: newWord,
                x: 5,
                y: 0,
                size: 10,
                color: "#000",
            });

            // Create edges if similar enough
            checkSimilarityWithWords(newWord, embd);
            wordEmbds[newWord] = embd;

            document.getElementById("input-word").value = "";
        })
        .then(() => {
            loader.style.display = "none";
        });
}

export function initGraph() {
    // Retrieve the html document for sigma container
    const container = document.getElementById("sigma-container");

    // Create a sample graph

    // Create the spring layout and start it
    const layout = new ForceSupervisor(graph, {
        isNodeFixed: (_, attr) => attr.highlighted,
    });
    layout.start();

    // Create the sigma
    const renderer = new Sigma(graph, container, {
        minCameraRatio: 0.5,
        maxCameraRatio: 2,
        height: "1080px",
        autoRescale: true,
    });

    // State for drag'n'drop
    let draggedNode = null;
    let isDragging = false;

    renderer.on("downNode", (e) => {
        isDragging = true;
        draggedNode = e.node;
        graph.setNodeAttribute(draggedNode, "highlighted", true);
        if (!renderer.getCustomBBox())
            renderer.setCustomBBox(renderer.getBBox());
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
}

export function drawWords() {
    getFirstWords().then(async (data) => {
        let firstWord1 = data.words[0];
        let firstWord2 = data.words[1];

        wordEmbds[firstWord1] = data.embeds[0];
        wordEmbds[firstWord2] = data.embeds[1];

        graph.addNode(firstWord1, {
            label: firstWord1,
            x: 0,
            y: 0,
            size: 10,
            color: "#00f",
        });
        graph.addNode(firstWord2, {
            label: firstWord2,
            x: -5,
            y: 5,
            size: 10,
            color: "#f00",
        });

        loader.style.display = "none";
    });
}
