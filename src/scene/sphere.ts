// three r125 made polyhedron detail linear (detail + 1 segments per edge instead of 2^detail),
// so detail 15 rebuilds the same 5120-triangle mesh the old detail 4 produced
export const sphereArgs: [number, number] = [1, 15]

export const restDistort: number = 0.4
