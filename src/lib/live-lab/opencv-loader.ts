type OpenCvModule = {
  Mat: new () => unknown;
  onRuntimeInitialized?: () => void;
};

type BrowserWindowWithCv = Window &
  typeof globalThis & {
    cv?: OpenCvModule;
  };

let openCvPromise: Promise<OpenCvModule> | null = null;

export async function loadOpenCv(): Promise<OpenCvModule> {
  if (typeof window === "undefined") {
    throw new Error("OpenCV so pode ser carregado no navegador.");
  }

  const browserWindow = window as BrowserWindowWithCv;

  if (browserWindow.cv?.Mat) {
    return browserWindow.cv;
  }

  if (openCvPromise) {
    return openCvPromise;
  }

  openCvPromise = new Promise<OpenCvModule>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-live-lab-opencv="true"]');

    const handleReady = () => {
      const nextCv = browserWindow.cv;

      if (nextCv?.Mat) {
        resolve(nextCv);
        return;
      }

      reject(new Error("OpenCV carregou, mas o runtime nao ficou disponivel."));
    };

    const attachRuntimeHandler = () => {
      const nextCv = browserWindow.cv;

      if (!nextCv) {
        return false;
      }

      if (nextCv.Mat) {
        resolve(nextCv);
        return true;
      }

      nextCv.onRuntimeInitialized = handleReady;
      return true;
    };

    if (attachRuntimeHandler()) {
      return;
    }

    const script = existingScript ?? document.createElement("script");

    script.async = true;
    script.defer = true;
    script.dataset.liveLabOpencv = "true";
    script.src = "/vendor/opencv/opencv.js";

    script.onload = () => {
      if (!attachRuntimeHandler()) {
        reject(new Error("OpenCV foi carregado, mas o objeto global cv nao apareceu."));
      }
    };

    script.onerror = () => {
      reject(new Error("Nao foi possivel carregar o runtime local do OpenCV."));
    };

    if (!existingScript) {
      document.body.appendChild(script);
    }
  }).catch((error) => {
    openCvPromise = null;
    throw error;
  });

  return openCvPromise;
}
