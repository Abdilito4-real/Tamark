"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

type InstallChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

const dismissedKey = "tamark-install-prompt-dismissed";
const installedKey = "tamark-app-installed";

export function InstallPromptBanner() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const dismissed = useRef(false);

  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const isStandalone = standaloneQuery.matches || Boolean(
      (window.navigator as Navigator & { standalone?: boolean }).standalone,
    );
    if (isStandalone) {
      setVisible(false);
      return;
    }

    try {
      if (window.localStorage.getItem(dismissedKey) === "true" ||
          window.localStorage.getItem(installedKey) === "true") {
        dismissed.current = true;
        return;
      }
    } catch (error) {
      console.error("Could not read app install preference:", error);
    }

    const isIos = /iPhone|iPad|iPod/.test(window.navigator.userAgent) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    setIsIos(isIos);
    if (isIos) setVisible(true);

    function handleInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      if (!dismissed.current) setVisible(true);
    }

    function handleInstalled() {
      try {
        window.localStorage.setItem(installedKey, "true");
      } catch (error) {
        console.error("Could not save app installation state:", error);
      }
      setPromptEvent(null);
      setVisible(false);
    }

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
        console.error("Could not register the app service worker:", error);
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  function dismiss() {
    dismissed.current = true;
    try {
      window.localStorage.setItem(dismissedKey, "true");
    } catch (error) {
      console.error("Could not save app install preference:", error);
    }
    setVisible(false);
  }

  async function install() {
    if (!promptEvent) {
      setShowIosInstructions((current) => !current);
      return;
    }
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPromptEvent(null);
      if (choice.outcome === "accepted") setVisible(false);
    } catch (error) {
      console.error("The app installation prompt could not be opened:", error);
      setPromptEvent(null);
    }
  }

  if (!visible) return null;

  return (
    <aside className="install-prompt" aria-label="Install Tamark Solar Energy">
      <BrandMark />
      <div className="install-prompt-copy">
        <strong>Install Tamark</strong>
        <span>
          {showIosInstructions
            ? <>{isIos && <Share size={14} aria-hidden="true" />} {isIos
              ? <>Tap Share, then “Add to Home Screen”.</>
              : <>Open the browser menu and choose “Install app” or “Add to Home Screen”.</>}</>
            : "Keep the training portal close at hand."}
        </span>
      </div>
      {!showIosInstructions && (
        <button className="button button-primary button-small" type="button" onClick={() => void install()}>
          {promptEvent && <Download size={15} aria-hidden="true" />}
          {promptEvent ? "Install" : "How to install"}
        </button>
      )}
      <button className="install-prompt-dismiss" type="button" onClick={dismiss} aria-label="Dismiss install prompt">
        <X size={18} aria-hidden="true" />
      </button>
    </aside>
  );
}
