export type BoardStage = "preflop" | "flop" | "turn" | "river" | "unknown";

export type BoardCardBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
  cornerConfidence?: number;
  rankGuess?: string | null;
  suitGuess?: string | null;
  rankConfidence?: number | null;
  suitConfidence?: number | null;
  combinedConfidence?: number | null;
  label?: string | null;
};

export type BoardDetectionResult = {
  cardCount: number;
  diffScore: number;
  stage: BoardStage;
  boxes: BoardCardBox[];
  detectedAt: string;
};

export type BoardWorkerAnalyzeRequest = {
  id: number;
  type: "analyze";
  width: number;
  height: number;
  data: ArrayBuffer;
};

export type BoardWorkerResetRequest = {
  type: "reset";
};

export type BoardWorkerRequest = BoardWorkerAnalyzeRequest | BoardWorkerResetRequest;

export type BoardWorkerResultMessage = {
  id: number;
  type: "result";
  detection: BoardDetectionResult;
};

export type BoardWorkerErrorMessage = {
  id: number;
  type: "error";
  message: string;
};

export type BoardWorkerMessage = BoardWorkerResultMessage | BoardWorkerErrorMessage;

type AnalyzeBoardReturn = {
  detection: BoardDetectionResult;
  grayPixels: Uint8ClampedArray;
};

const BRIGHTNESS_THRESHOLD_FLOOR = 120;
const MIN_AREA_RATIO = 0.0045;
const MAX_AREA_RATIO = 0.34;
const MIN_ASPECT_RATIO = 0.3;
const MAX_ASPECT_RATIO = 1.18;
const SINGLE_CARD_ASPECT_RATIO = 0.46;
const WIDE_BOX_SPLIT_THRESHOLD = 1.05;
const MAX_COLOR_SPREAD_FOR_CARD = 128;
const COLUMN_GAP_TOLERANCE = 8;
const MIN_RELATIVE_HEIGHT = 0.18;
const MIN_FILL_DENSITY = 0.028;
const EDGE_MARGIN_RATIO = 0.035;
const MIN_CORNER_CONFIDENCE = 0.02;
const MIN_BOX_CONFIDENCE = 0.045;

export function analyzeBoardImageData(
  width: number,
  height: number,
  rgbaPixels: Uint8ClampedArray,
  previousGrayPixels?: Uint8ClampedArray | null,
): AnalyzeBoardReturn {
  const totalPixels = width * height;
  const grayPixels = new Uint8ClampedArray(totalPixels);
  const candidateMask = new Uint8Array(totalPixels);
  const brightnessHistogram = new Uint32Array(256);

  for (let index = 0; index < totalPixels; index += 1) {
    const rgbaIndex = index * 4;
    const gray = Math.round(
      rgbaPixels[rgbaIndex] * 0.299 +
        rgbaPixels[rgbaIndex + 1] * 0.587 +
        rgbaPixels[rgbaIndex + 2] * 0.114,
    );
    grayPixels[index] = gray;
    brightnessHistogram[gray] += 1;
  }

  const threshold = resolveBrightnessThreshold(brightnessHistogram, totalPixels);
  const visited = new Uint8Array(totalPixels);
  const totalArea = width * height;

  for (let index = 0; index < totalPixels; index += 1) {
    const rgbaIndex = index * 4;
    const red = rgbaPixels[rgbaIndex];
    const green = rgbaPixels[rgbaIndex + 1];
    const blue = rgbaPixels[rgbaIndex + 2];
    const minChannel = Math.min(red, green, blue);
    const colorSpread = Math.max(red, green, blue) - Math.min(red, green, blue);

    const isStrictCardPixel =
      grayPixels[index] >= threshold && colorSpread <= MAX_COLOR_SPREAD_FOR_CARD;
    const isSoftCardPixel =
      grayPixels[index] >= threshold - 18 && minChannel >= 72 && colorSpread <= 175;

    if (isStrictCardPixel || isSoftCardPixel) {
      candidateMask[index] = 1;
    }
  }

  const projectionBoxes = detectBoxesFromProjection(
    candidateMask,
    grayPixels,
    width,
    height,
    totalArea,
  );
  const componentBoxes: BoardCardBox[] = [];

  for (let index = 0; index < totalPixels; index += 1) {
    if (visited[index] === 1 || candidateMask[index] === 0) {
      continue;
    }

    const box = floodFillComponent({
      candidateMask,
      visited,
      startIndex: index,
      width,
      height,
    });

    if (!box) {
      continue;
    }

    if (!isValidCardBox(box, candidateMask, grayPixels, width, height, totalArea)) {
      continue;
    }

    componentBoxes.push(box);
  }

  const normalizedComponentBoxes = splitWideBoxes(
    componentBoxes,
    candidateMask,
    grayPixels,
    width,
    height,
    totalArea,
  );
  const normalizedProjectionBoxes = splitWideBoxes(
    projectionBoxes,
    candidateMask,
    grayPixels,
    width,
    height,
    totalArea,
  );
  const supplementedBoxes =
    normalizedComponentBoxes.length > 0
      ? mergeProjectionSupplements(normalizedComponentBoxes, normalizedProjectionBoxes)
      : normalizedProjectionBoxes;
  const normalizedBoxes = dedupeBoxes(supplementedBoxes).sort((left, right) => left.x - right.x);
  const cardCount = normalizedBoxes.length;

  return {
    detection: {
      cardCount,
      diffScore: computeDiffScore(grayPixels, previousGrayPixels),
      stage: resolveBoardStage(cardCount),
      boxes: normalizedBoxes,
      detectedAt: new Date().toISOString(),
    },
    grayPixels,
  };
}

export function drawBoardDetections(canvas: HTMLCanvasElement, detection: BoardDetectionResult) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.save();
  context.lineWidth = 3;
  context.strokeStyle = "rgba(255, 205, 76, 0.96)";
  context.fillStyle = "rgba(255, 205, 76, 0.16)";
  context.font = "bold 14px Arial";

  detection.boxes.forEach((box, index) => {
    context.fillRect(box.x, box.y, box.width, box.height);
    context.strokeRect(box.x, box.y, box.width, box.height);
    context.fillStyle = "rgba(7, 22, 15, 0.92)";
    context.fillRect(box.x + 6, box.y + 6, 52, 18);
    context.fillStyle = "rgba(255, 235, 185, 0.98)";
    context.fillText(String(index + 1), box.x + 14, box.y + 20);
    if (typeof box.confidence === "number") {
      context.fillText(`${Math.round(box.confidence * 100)}%`, box.x + 32, box.y + 20);
    }
    context.fillStyle = "rgba(255, 205, 76, 0.16)";
  });

  context.restore();
}

function floodFillComponent({
  candidateMask,
  visited,
  startIndex,
  width,
  height,
}: {
  candidateMask: Uint8Array;
  visited: Uint8Array;
  startIndex: number;
  width: number;
  height: number;
}) {
  const queue = [startIndex];
  let head = 0;
  visited[startIndex] = 1;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let pixelCount = 0;

  while (head < queue.length) {
    const currentIndex = queue[head];
    head += 1;

    const x = currentIndex % width;
    const y = Math.floor(currentIndex / width);
    pixelCount += 1;

    if (x < minX) {
      minX = x;
    }
    if (y < minY) {
      minY = y;
    }
    if (x > maxX) {
      maxX = x;
    }
    if (y > maxY) {
      maxY = y;
    }

    const neighbors = [
      currentIndex - 1,
      currentIndex + 1,
      currentIndex - width,
      currentIndex + width,
    ];

    for (const neighbor of neighbors) {
      if (neighbor < 0 || neighbor >= candidateMask.length || visited[neighbor] === 1) {
        continue;
      }

      const neighborX = neighbor % width;
      const neighborY = Math.floor(neighbor / width);

      if (Math.abs(neighborX - x) + Math.abs(neighborY - y) !== 1) {
        continue;
      }

      if (candidateMask[neighbor] === 0) {
        continue;
      }

      visited[neighbor] = 1;
      queue.push(neighbor);
    }
  }

  if (pixelCount < 32) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function resolveBrightnessThreshold(histogram: Uint32Array, totalPixels: number) {
  const targetRank = Math.max(1, Math.floor(totalPixels * 0.88));
  let seen = 0;
  let percentileValue = 255;

  for (let index = 0; index < histogram.length; index += 1) {
    seen += histogram[index];

    if (seen >= targetRank) {
      percentileValue = index;
      break;
    }
  }

  return Math.max(BRIGHTNESS_THRESHOLD_FLOOR, percentileValue - 18);
}

function computeDiffScore(
  currentGrayPixels: Uint8ClampedArray,
  previousGrayPixels?: Uint8ClampedArray | null,
) {
  if (!previousGrayPixels || previousGrayPixels.length !== currentGrayPixels.length) {
    return 0;
  }

  let total = 0;

  for (let index = 0; index < currentGrayPixels.length; index += 1) {
    total += Math.abs(currentGrayPixels[index] - previousGrayPixels[index]);
  }

  return Number((total / currentGrayPixels.length).toFixed(2));
}

function dedupeBoxes(boxes: BoardCardBox[]) {
  const sortedBoxes = [...boxes].sort(
    (left, right) => left.width * left.height - right.width * right.height,
  );
  const keptBoxes: BoardCardBox[] = [];

  for (const box of sortedBoxes) {
    const overlapsExisting = keptBoxes.some((candidate) => intersectionRatio(box, candidate) > 0.7);

    if (!overlapsExisting) {
      keptBoxes.push(box);
    }
  }

  return keptBoxes;
}

function detectBoxesFromProjection(
  candidateMask: Uint8Array,
  grayPixels: Uint8ClampedArray,
  width: number,
  height: number,
  totalArea: number,
) {
  const columnCounts = new Array<number>(width).fill(0);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (candidateMask[y * width + x] === 1) {
        columnCounts[x] += 1;
      }
    }
  }

  const smoothed = smoothCounts(columnCounts, 3);
  const minColumnHits = Math.max(4, Math.round(height * 0.1));
  const segments: Array<{ startX: number; endX: number }> = [];

  let segmentStart = -1;
  let gapRun = 0;

  for (let x = 0; x < width; x += 1) {
    if (smoothed[x] >= minColumnHits) {
      if (segmentStart === -1) {
        segmentStart = x;
      }
      gapRun = 0;
      continue;
    }

    if (segmentStart === -1) {
      continue;
    }

    gapRun += 1;

    if (gapRun <= COLUMN_GAP_TOLERANCE) {
      continue;
    }

    segments.push({ startX: segmentStart, endX: x - gapRun });
    segmentStart = -1;
    gapRun = 0;
  }

  if (segmentStart !== -1) {
    segments.push({ startX: segmentStart, endX: width - 1 });
  }

  return segments
    .map((segment) => buildProjectionBox(candidateMask, width, height, segment.startX, segment.endX))
    .filter((box): box is BoardCardBox => Boolean(box))
    .filter((box) => isValidCardBox(box, candidateMask, grayPixels, width, height, totalArea));
}

function buildProjectionBox(
  candidateMask: Uint8Array,
  width: number,
  height: number,
  startX: number,
  endX: number,
) {
  const segmentWidth = endX - startX + 1;

  if (segmentWidth < 10) {
    return null;
  }

  const rowCounts = new Array<number>(height).fill(0);

  for (let y = 0; y < height; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      if (candidateMask[y * width + x] === 1) {
        rowCounts[y] += 1;
      }
    }
  }

  const smoothedRows = smoothCounts(rowCounts, 2);
  const minRowHits = Math.max(3, Math.round(segmentWidth * 0.08));
  let startY = -1;
  let endY = -1;

  for (let y = 0; y < height; y += 1) {
    if (smoothedRows[y] >= minRowHits) {
      if (startY === -1) {
        startY = y;
      }
      endY = y;
    }
  }

  if (startY === -1 || endY === -1) {
    return null;
  }

  return {
    x: startX,
    y: startY,
    width: segmentWidth,
    height: endY - startY + 1,
  };
}

function smoothCounts(values: number[], radius: number) {
  return values.map((_, index) => {
    let sum = 0;
    let count = 0;

    for (let offset = -radius; offset <= radius; offset += 1) {
      const neighborIndex = index + offset;

      if (neighborIndex < 0 || neighborIndex >= values.length) {
        continue;
      }

      sum += values[neighborIndex];
      count += 1;
    }

    return sum / Math.max(count, 1);
  });
}

function splitWideBoxes(
  boxes: BoardCardBox[],
  candidateMask: Uint8Array,
  grayPixels: Uint8ClampedArray | null,
  width: number,
  height: number,
  totalArea: number,
) {
  const normalized: BoardCardBox[] = [];

  for (const box of boxes) {
    const aspectRatio = box.width / Math.max(box.height, 1);

    if (aspectRatio <= WIDE_BOX_SPLIT_THRESHOLD) {
      normalized.push(box);
      continue;
    }

    const segmentedSlices = splitBoxByProjection(
      box,
      candidateMask,
      grayPixels,
      width,
      height,
      totalArea,
    );

    if (segmentedSlices.length > 1) {
      normalized.push(...segmentedSlices);
      continue;
    }

    const estimatedCount = Math.max(
      1,
      Math.min(5, Math.round(box.width / Math.max(box.height * SINGLE_CARD_ASPECT_RATIO, 1))),
    );

    if (estimatedCount <= 1) {
      normalized.push(box);
      continue;
    }

    const sliceWidth = box.width / estimatedCount;

    for (let index = 0; index < estimatedCount; index += 1) {
      const startX = box.x + sliceWidth * index;
      const endX = box.x + sliceWidth * (index + 1);
      const sliceBox: BoardCardBox = {
        x: Math.round(startX),
        y: box.y,
        width: Math.max(1, Math.round(endX - startX)),
        height: box.height,
      };

      if (isValidCardBox(sliceBox, candidateMask, grayPixels, width, height, totalArea)) {
        normalized.push(sliceBox);
      }
    }
  }

  return normalized;
}

function mergeProjectionSupplements(
  componentBoxes: BoardCardBox[],
  projectionBoxes: BoardCardBox[],
) {
  const merged = [...componentBoxes];

  for (const projectionBox of projectionBoxes) {
    const overlapsExisting = merged.some((candidate) => intersectionRatio(projectionBox, candidate) > 0.45);

    if (!overlapsExisting) {
      merged.push(projectionBox);
    }
  }

  return merged;
}

function splitBoxByProjection(
  box: BoardCardBox,
  candidateMask: Uint8Array,
  grayPixels: Uint8ClampedArray | null,
  width: number,
  height: number,
  totalArea: number,
) {
  const columnCounts = new Array<number>(box.width).fill(0);

  for (let y = box.y; y < box.y + box.height; y += 1) {
    const rowOffset = y * width;

    for (let x = box.x; x < box.x + box.width; x += 1) {
      if (candidateMask[rowOffset + x] === 1) {
        columnCounts[x - box.x] += 1;
      }
    }
  }

  const smoothed = smoothCounts(columnCounts, 2);
  const minColumnHits = Math.max(3, Math.round(box.height * 0.08));
  const segments: Array<{ startX: number; endX: number }> = [];
  let segmentStart = -1;
  let gapRun = 0;

  for (let index = 0; index < smoothed.length; index += 1) {
    if (smoothed[index] >= minColumnHits) {
      if (segmentStart === -1) {
        segmentStart = index;
      }
      gapRun = 0;
      continue;
    }

    if (segmentStart === -1) {
      continue;
    }

    gapRun += 1;

    if (gapRun <= Math.max(2, Math.round(COLUMN_GAP_TOLERANCE / 2))) {
      continue;
    }

    segments.push({ startX: segmentStart, endX: index - gapRun });
    segmentStart = -1;
    gapRun = 0;
  }

  if (segmentStart !== -1) {
    segments.push({ startX: segmentStart, endX: smoothed.length - 1 });
  }

  return segments
    .map((segment) => {
      const startX = box.x + segment.startX;
      const endX = box.x + segment.endX;
      const projectionBox = buildProjectionBox(candidateMask, width, height, startX, endX);

      if (!projectionBox) {
        return null;
      }

      return isValidCardBox(projectionBox, candidateMask, grayPixels, width, height, totalArea)
        ? projectionBox
        : null;
    })
    .filter((candidate): candidate is BoardCardBox => Boolean(candidate));
}

function isValidCardBox(
  box: BoardCardBox,
  candidateMask: Uint8Array,
  grayPixels: Uint8ClampedArray | null,
  width: number,
  height: number,
  totalArea: number,
) {
  const area = box.width * box.height;
  const areaRatio = area / Math.max(totalArea, 1);
  const aspectRatio = box.width / Math.max(box.height, 1);
  const relativeHeight = box.height / Math.max(height, 1);

  if (areaRatio < MIN_AREA_RATIO || areaRatio > MAX_AREA_RATIO) {
    return false;
  }

  if (aspectRatio < MIN_ASPECT_RATIO || aspectRatio > MAX_ASPECT_RATIO) {
    return false;
  }

  if (relativeHeight < MIN_RELATIVE_HEIGHT) {
    return false;
  }

  const edgeMarginX = Math.max(3, Math.round(width * EDGE_MARGIN_RATIO));
  const edgeMarginY = Math.max(3, Math.round(height * EDGE_MARGIN_RATIO));
  const touchesHorizontalEdge =
    box.x <= edgeMarginX || box.x + box.width >= width - edgeMarginX;
  const touchesVerticalEdge =
    box.y <= edgeMarginY || box.y + box.height >= height - edgeMarginY;

  const fillDensity = measureFillDensity(box, candidateMask, width);
  const cornerConfidence = grayPixels
    ? measureCornerConfidence(box, grayPixels, width)
    : 0.12;
  const confidence =
    fillDensity * 0.58 +
    cornerConfidence * 0.2 +
    Math.min(1, relativeHeight) * 0.22;

  if ((touchesHorizontalEdge || touchesVerticalEdge) && fillDensity < 0.18) {
    return false;
  }

  box.cornerConfidence = cornerConfidence;
  box.confidence = confidence;

  if (fillDensity < MIN_FILL_DENSITY) {
    return false;
  }

  if (confidence < MIN_BOX_CONFIDENCE) {
    return false;
  }

  // Nessa fase, a contagem do board prioriza "presenca de carta" e nao
  // depende mais de um canto fortemente reconhecivel para rank/naipe.
  if (cornerConfidence < MIN_CORNER_CONFIDENCE) {
    return true;
  }

  return true;
}

function measureFillDensity(box: BoardCardBox, candidateMask: Uint8Array, width: number) {
  let hits = 0;
  const total = Math.max(box.width * box.height, 1);

  for (let y = box.y; y < box.y + box.height; y += 1) {
    const rowOffset = y * width;

    for (let x = box.x; x < box.x + box.width; x += 1) {
      if (candidateMask[rowOffset + x] === 1) {
        hits += 1;
      }
    }
  }

  return hits / total;
}

function measureCornerConfidence(
  box: BoardCardBox,
  grayPixels: Uint8ClampedArray,
  width: number,
) {
  const cornerWidth = Math.max(6, Math.round(box.width * 0.34));
  const cornerHeight = Math.max(8, Math.round(box.height * 0.38));
  const corners = [
    { startX: box.x, startY: box.y },
    { startX: box.x + box.width - cornerWidth, startY: box.y },
    { startX: box.x, startY: box.y + box.height - cornerHeight },
    {
      startX: box.x + box.width - cornerWidth,
      startY: box.y + box.height - cornerHeight,
    },
  ];

  let bestConfidence = 0;

  for (const corner of corners) {
    const startX = Math.max(0, corner.startX);
    const startY = Math.max(0, corner.startY);
    const endX = Math.min(width, startX + cornerWidth);
    const endY = startY + cornerHeight;

    let brightPixels = 0;
    let darkPixels = 0;
    let total = 0;

    for (let y = startY; y < endY; y += 1) {
      const rowOffset = y * width;

      for (let x = startX; x < endX; x += 1) {
        const gray = grayPixels[rowOffset + x];
        total += 1;

        if (gray >= 170) {
          brightPixels += 1;
        } else if (gray <= 115) {
          darkPixels += 1;
        }
      }
    }

    if (total === 0) {
      continue;
    }

    const brightRatio = brightPixels / total;
    const darkRatio = darkPixels / total;

    if (brightRatio < 0.24 || darkRatio < 0.018) {
      continue;
    }

    const confidence = Math.min(1, brightRatio * darkRatio * 7.6);
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
    }
  }

  return bestConfidence;
}

function intersectionRatio(left: BoardCardBox, right: BoardCardBox) {
  const xOverlap = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const yOverlap = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  const intersectionArea = xOverlap * yOverlap;

  if (intersectionArea <= 0) {
    return 0;
  }

  const minArea = Math.min(left.width * left.height, right.width * right.height);
  return intersectionArea / Math.max(minArea, 1);
}

function resolveBoardStage(cardCount: number): BoardStage {
  if (cardCount === 0) {
    return "preflop";
  }

  if (cardCount === 3) {
    return "flop";
  }

  if (cardCount === 4) {
    return "turn";
  }

  if (cardCount >= 5) {
    return "river";
  }

  return "unknown";
}
