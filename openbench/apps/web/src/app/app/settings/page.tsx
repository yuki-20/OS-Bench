"use client";

import { Card, CardBody, CardHeader, CardTitle, Banner } from "@/components/ui";

export default function BenchSettings() {
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Banner>
        Use the toolbar at the top to enable Large text, High contrast, or Critical-only modes.
      </Banner>
      <Card>
        <CardHeader><CardTitle>Voice commands</CardTitle></CardHeader>
        <CardBody>
          <ul className="text-sm list-disc pl-5 space-y-1">
            <li><code>Next step</code> - complete current step</li>
            <li><code>Repeat step</code> or <code>read step aloud</code> - TTS readback</li>
            <li><code>Pause</code> / <code>resume</code></li>
            <li><code>Log note: ...</code> - quick observation</li>
            <li><code>Mark deviation</code> - open deviation form</li>
            <li><code>Start timer</code> - 5-minute timer</li>
            <li><code>Check setup</code> or <code>photo check</code> - open photo modal</li>
            <li><code>Generate handover</code> - produce handover report</li>
            <li>Anything else is treated as a question for the Execution Coach.</li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
