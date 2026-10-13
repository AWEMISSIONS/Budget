"use client";
import { useState } from "react";
import { Landmark, LockKeyhole } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export default function PinGate() {
  const [pin, setPin] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="pin-page">
      <form
        className="pin-card"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          const response = await fetch("/api/auth", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ pin }),
          });
          setBusy(false);
          if (response.ok) window.location.reload();
          else setError("That PIN is not correct.");
        }}
      >
        <i className="pin-logo"><Landmark /></i>
        <h1>Family Budget</h1>
        <p>Enter your six-digit household PIN.</p>
        <label>
          <span>PIN</span>
          <Input
            autoFocus
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
            aria-invalid={Boolean(error)}
          />
        </label>
        {error && <small className="pin-error">{error}</small>}
        <Button disabled={pin.length !== 6 || busy} type="submit">
          <LockKeyhole /> {busy ? "Unlocking…" : "Unlock budget"}
        </Button>
      </form>
    </main>
  );
}
