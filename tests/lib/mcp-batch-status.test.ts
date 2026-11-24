import { describe, expect, it } from "vitest";
import { variantStatus, batchState, batchCounts } from "@/lib/mcp/batch-status";

describe("MCP public execution status", () => {
  it.each([
    ["queued", null, null, "queued"],
    ["submitting", "queueing_up", null, "submitting"],
    ["running", "queued", "remote", "provider_queued"],
    ["running", "IN_QUEUE", "remote", "provider_queued"],
    ["running", "processing", "remote", "running"],
    ["running", "IN_PROGRESS", "remote", "running"],
    ["running", "finalizing", "remote", "finalizing"],
    ["running", "completed", "remote", "succeeded"],
    ["running", "failed", "remote", "failed"],
    ["running", "canceled", "remote", "cancelled"],
    ["running", null, "remote", "awaiting_status"],
    ["running", "something_new", "remote", "awaiting_status"],
    ["running", null, null, "awaiting_status"],
    ["submitting", "queueing_up", "remote", "awaiting_status"],
    ["submission_unknown", "submission_unknown", null, "submission_unknown"],
    ["succeeded", null, "remote", "succeeded"],
    ["failed", null, null, "failed"],
    ["cancelled", null, null, "cancelled"],
  ])("%s + Job %s with receipt %s reports %s", (state, status, providerJobId, expected) => {
    const result = variantStatus({ state: state!, providerJobId }, status ? { status } : null, false, false);
    expect(result.state).toBe(expected);
    expect(result.phase).toBe(expected);
    expect(result.lifecycleState).toBe(state);
  });
  it("keeps cancellation intent separate from known provider queue and eventual success", () => {
    expect(variantStatus({state:"running"}, {status:"queued"}, true, false))
      .toMatchObject({state:"cancel_requested",phase:"provider_queued",isTerminal:false,cancellationRequested:true});
    expect(variantStatus({state:"running"}, {status:"completed"}, true, false))
      .toMatchObject({state:"succeeded",isTerminal:true,cancellationRequested:true});
    expect(variantStatus({state:"running"}, {status:"failed",error:"cancelled"}, true, false).state).toBe("cancelled");
  });
  it("blocks local siblings of an uncertain submission without mislabeling provider work", () => {
    expect(variantStatus({state:"queued"},null,false,true))
      .toMatchObject({state:"blocked",phase:"queued",blockedReason:"SUBMISSION_UNKNOWN"});
    expect(variantStatus({state:"running"},{status:"queued"},false,true).state).toBe("provider_queued");
    expect(variantStatus({state:"submission_unknown"},null,true,true).state).toBe("submission_unknown");
  });
  it.each([
    [["succeeded","queued"],"queued"],
    [["failed","provider_queued"],"provider_queued"],
    [["succeeded","submitting"],"submitting"],
    [["provider_queued","running"],"running"],
    [["provider_queued","finalizing"],"finalizing"],
    [["succeeded","awaiting_status"],"awaiting_status"],
    [["succeeded","failed"],"partial"],
    [["succeeded","succeeded"],"completed"],
    [["failed","cancelled"],"failed"],
    [["cancelled","cancelled"],"cancelled"],
    [["submission_unknown","running"],"needs_attention"],
  ])("aggregates %j into %s", (states, expected) => {
    expect(batchState(states.map(state=>({state})),false)).toBe(expected);
  });
  it("counts each variant once and does not count cancellation as confirmed running", () => {
    const states=["succeeded","provider_queued","queued","cancel_requested","blocked","submission_unknown"];
    const counts=batchCounts(states.map(state=>({state})));
    expect(counts).toMatchObject({total:6,succeeded:1,providerQueued:1,queued:1,cancelRequested:1,blocked:1,submissionUnknown:1,running:0});
    expect(Object.entries(counts).filter(([k])=>k!=="total").reduce((n,[,v])=>n+v,0)).toBe(counts.total);
  });
});
