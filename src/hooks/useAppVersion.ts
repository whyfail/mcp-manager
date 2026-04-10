import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useAppVersion() {
  const [appVersion, setAppVersion] = useState("1.0.3");

  useEffect(() => {
    invoke<{ version: string }>("get_version")
      .then((res) => setAppVersion(res.version))
      .catch(() => {});
  }, []);

  return appVersion;
}
