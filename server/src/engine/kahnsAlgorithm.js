/**
 * Kahn's Algorithm Implementation for Directed Acyclic Graphs (DAGs)
 * Time Complexity: O(V + E)
 * Space Complexity: O(V + E)
 *
 * Used for:
 * 1. Cycle detection (rejects recursive/circular execution loops)
 * 2. Generating a deterministic topological execution order
 */

export function runKahnsAlgorithm(nodes = [], edges = []) {
  if (!nodes || nodes.length === 0) {
    return {
      isValid: true,
      topologicalOrder: [],
      hasCycle: false,
    };
  }

  const inDegree = new Map();
  const adjacencyList = new Map();
  const nodeMap = new Map();

  // Initialize adjacency list and in-degree maps
  for (const node of nodes) {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    adjacencyList.set(node.id, []);
  }

  // Populate graph edges and compute in-degrees
  for (const edge of edges) {
    const { source, target } = edge;

    if (!nodeMap.has(source) || !nodeMap.has(target)) {
      continue;
    }

    adjacencyList.get(source).push(target);
    inDegree.set(target, (inDegree.get(target) || 0) + 1);
  }

  // Queue of all nodes with 0 in-degree (entrypoint / trigger nodes)
  const queue = [];
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  const topologicalOrder = [];

  // Process nodes in topological order
  while (queue.length > 0) {
    const currentId = queue.shift();
    topologicalOrder.push(nodeMap.get(currentId));

    const neighbors = adjacencyList.get(currentId) || [];
    for (const neighbor of neighbors) {
      const updatedDegree = inDegree.get(neighbor) - 1;
      inDegree.set(neighbor, updatedDegree);

      if (updatedDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // If topological order contains fewer nodes than total graph, a cycle exists
  const hasCycle = topologicalOrder.length !== nodes.length;

  if (hasCycle) {
    const unprocessed = nodes
      .filter((n) => !topologicalOrder.some((ordered) => ordered.id === n.id))
      .map((n) => n.id);

    return {
      isValid: false,
      hasCycle: true,
      cycleNodes: unprocessed,
      error: `Cycle detected in workflow graph involving node(s): ${unprocessed.join(', ')}`,
      topologicalOrder: [],
    };
  }

  return {
    isValid: true,
    hasCycle: false,
    topologicalOrder,
  };
}
