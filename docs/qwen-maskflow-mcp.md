# Qwen Image Edit2511 + MaskFlow (MCP only)

Endpointsource: https://github.com/itzing/qwen_image_edit_maskflow . No desktop/mobile rollout, no replacement of ordinaryQwen. Dedicatedmodel ID `qwen-image-edit-maskflow`, mode `masked_image_edit`. Exactlyone source reference and a separate mask.

Prepare example (replace the asset ID; review frozenplan before paidstart):
```json
{
  "modelId":"qwen-image-edit-maskflow",
  "mode":"masked_image_edit",
  "prompt":"Replace the selected object with a red sphere. Keep the surrounding scene unchanged.",
  "references":[{"kind":"gallery_asset","assetId":"REAL_SOURCE_ASSET_ID"}],
  "mask":{"kind":"rectangles","regions":[{"x":0.25,"y":0.25,"width":0.5,"height":0.5}]},
  "width":1024,"height":1024,"variantCount":1,"seeds":[42],
  "parameters":{"steps":50,"guidance":4},
  "requestKey":"REPLACE_WITH_A_NEW_UUID"
}
```

An image mask can instead use `mask:{kind:"image",source:{kind:"gallery_asset",assetId:"REAL_MASK_ID"}}`. Existing job outputs are also supported as media references. Mask must be opaquegrayscale and exactlymatchsource dimensions; white edits,black preserves,gray softens. Bothfiles neednormalizedEXIForientation. Rectangles are normalized0..1 againstfullsource; max32unionedrectangles. No automatictextsegmentation, no mask-as-secondary-reference convention.

Maxoutput1MP, sides256..2048,multiples64. Source+maskresizeidentically;chooseoriginalaspectratio. BaselineofficiallatestscenesSFT,50steps,CFG4,Soft-Poisson;noLightningorimplicitdistillation/userLoRA. Mask/sourcehashes andgeometryfrozeninplanandrecheckedbeforestart/dispatch. A changed/deletedassetinvalidatestheplan;reuse bypreparinganewrequestfromsnapshot.draft.

Prompt+authenticatedgenerationsettings+source+mask+result useEnguiAES256GCMv1withjob/model/attempt/direction/rolebindings. No plaintextfallback. Endpointusessecret-backedmasterkey, runtimeS3credentialsoutsideGit,publicmodelcache,onejobperworker.

Deploy usespublishedCUDA/PyTorchimagedigest pluspinnedbootstrap,notDockerbuild. Cache andruntimehaveimmutableupstream/model/adapters revisions. minWorkers0,maxWorkers2; coldstartdownloadsweightsbeforefirstinference. Do not inferreadiness from configured=true or queued lifecycle. Use batchphase/counts andpollAfterSeconds;neverblindlyretryuncertainsubmissions.
