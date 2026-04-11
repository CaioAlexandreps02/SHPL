import {
  analyzeBoardImageData,
  type BoardWorkerMessage,
  type BoardWorkerRequest,
} from "@/lib/live-lab/board-detection";

let previousGrayPixels: Uint8ClampedArray | null = null;

self.onmessage = (event: MessageEvent<BoardWorkerRequest>) => {
  const message = event.data;

  if (message.type === "reset") {
    previousGrayPixels = null;
    return;
  }

  try {
    const rgbaPixels = new Uint8ClampedArray(message.data);
    const { detection, grayPixels } = analyzeBoardImageData(
      message.width,
      message.height,
      rgbaPixels,
      previousGrayPixels,
    );

    previousGrayPixels = grayPixels;

    const response: BoardWorkerMessage = {
      id: message.id,
      type: "result",
      detection,
    };

    self.postMessage(response);
  } catch (error) {
    const response: BoardWorkerMessage = {
      id: message.id,
      type: "error",
      message:
        error instanceof Error
          ? error.message
          : "Falha ao analisar o board no worker.",
    };

    self.postMessage(response);
  }
};

export {};
