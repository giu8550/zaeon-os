"use client";

import { useState } from "react";
import CodeInputStep from "./CodeInputStep";
import ConviteAgent from "./ConviteAgent";
import GoogleFinishStep from "./GoogleFinishStep";

type Step = "code" | "chat" | "google";

interface Props {
  initialCode?: string;
}

export default function ConviteFlow({ initialCode }: Props) {
  const [step, setStep] = useState<Step>("code");
  const [sessionToken, setSessionToken] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const handleValidated = (token: string, code: string) => {
    setSessionToken(token);
    setInviteCode(code);
    setStep("chat");
  };

  const handleChatComplete = () => {
    setStep("google");
  };

  if (step === "code") {
    return (
      <CodeInputStep
        initialCode={initialCode}
        onValidated={handleValidated}
      />
    );
  }

  if (step === "chat") {
    return (
      <ConviteAgent
        sessionToken={sessionToken}
        inviteCode={inviteCode}
        onComplete={handleChatComplete}
      />
    );
  }

  return <GoogleFinishStep sessionToken={sessionToken} />;
}
