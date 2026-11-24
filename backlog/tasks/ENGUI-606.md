# ENGUI-606 — Secure Qwen2511 MaskFlow endpoint and MCP

## Status
In Progress

## Scope
Owner14809 authorizes separate endpoint repo and two worker slots reallocated Krea2 max8->6/Qwen0->2,min0. Follow-up scope: MCP + endpoint ONLY, no desktop/mobile changes. Preserve no custom Docker build: ready CUDA/PyTorch base plus pinned bootstrap. Dedicated MCP model qwen-image-edit-maskflow, explicit source and mask (owned image or normalized rectangles), no primary Character. Existing regular Qwen, UI and historical plans remain unchanged.

## Acceptance
Authenticated/encrypted prompt,source,mask,result; strict job/attempt/model/role bindings and scoped paths; no plaintext transport. Official pinned MaskFlow pipeline and latest scenes adapter, no Lightning mixing. Validate mask alignment/content and workspace ownership, freeze mask snapshot/hash and recheck atstart/dispatch. MCP model/guide describes required masks,50-step baseline and no automatic segmentation. Separate GitHub repo with reproducible startup and CPU regression tests; live synthetic secure proof on RunPod, no user media. Persist full rollback before resource mutations; no activeKrea jobs interrupted. min0,max2; standby0.

## Validation
Endpoint secure Python tests + cross-language AES fixture, MCP plan/discovery/dispatch/staleness tests, production build and candidateHTTP proof. LiveGPU synthetic edit and background check bounded to one baseline validation request; report real status, no claim success until verified.

## Candidate checks
- Endpoint16CPU contract tests passed. NewMCP18integration tests passed, including realTSenvelopes consumed by Pythonhandler and encryptedresult verified by TS.
- Full regression191tests/9files passed after increasing the newfile's timeout under concurrentbuild/SQLitecontention; no codefailure remained.
- Productionbuildpassed;125TypeScriptdiagnostics baseline andcandidate, noadded diagnosticlocations.
- CandidateHTTP22SDKchecks passed: maskedmodeldiscovery/schema,50stepCFG4defaults, frozenmaskreadback, plain/taggedlegacyflows, strictremovedCharacterselectors. NoUI model-list exposure.
- Endpointrepo https://github.com/itzing/qwen_image_edit_maskflow . ReadyPyTorchCUDAimage, noDockerbuild. Sharedmodelcache100GBcreatedUS-NC-2; transportusesexistingencryptedS3EU-CZ.
- Quotaallocation verified Krea2max6/QwenMaskFlowmax2,min0both. ExistingQwenendpointdnc6cjeffpqwfy reused with rollback snapshot.
- Liveone-synthetic-jobacceptedafteranexplicit409rejectionwithzerojobcount andcompletedrollout; id18e625b4-68a6-466f-b733-4431a542b108-e2. CurrentlyverifyingGPUresult. No user media.
