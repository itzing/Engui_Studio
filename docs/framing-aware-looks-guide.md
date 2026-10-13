# Framing-aware looks
## Characters
Open **Characters → Identity visible details** to review the permanent identity by body region. Save the character normally after editing. In **Wardrobe & outfit library → Edit → Outfit visible details**, split clothing into visible regions. Keep an item's description self-contained: a collar fragment should not also demand an ankle-length hem.

**Inspect preview prompt** is free. Select Portrait, Upper body or Full body and inspect the exact composed text without submitting a job. It reads the saved character and current outfit selection.

Source text is preserved. Editing source traits, gender, outfit description, constraints or face-covering state makes old classification stale. Review/update the parts before cropped generation. Full-body use can retain an unclassified source description. Do not put an entire costume in the identity region; it is intended for age, gender and skin.

For a covering helmet, mark only genuinely exposed face details (such as Protector's jaw) as visible under the covering. Hair and other face details are omitted, and the helmet remains in place. No claim of pixel-perfect framing is made: this removes conflicting conditioning, but the image model may still deviate.

## Studio
New runs pin structured identity/outfit snapshots. Shot framing comes from the selected pose: closeup, portrait, half_body, three_quarter or full_body. In **Pose Library → pose → Framing & visible details**, add arms/hands only when the pose brings them inside that crop. This changes included detail, not camera distance. Lower legs and footwear are omitted from knee-length crops.

The shot prompt starts with framing and pose, followed by visible identity, outfit, environment, light and style. Krea2 uses text only. Existing OpenPose controls remain available for Z-Image; changing a pose's framing invalidates mismatched controls. Geometric framing presets still apply to controls, but their free-text helper does not override structured shot framing.

Custom session outfits support the same visible-parts editor in the session brief. New runs snapshot it. Old executed runs/revisions retain their exact text and results; create a new run from the session to adopt revised look metadata. The migration upgrades only pristine compatible Showdown drafts with no revisions/results.

## Showdown rollout
Seven current characters/default outfits are classified, including Bureaucrat Male. Original traits/descriptions and old versions remain. Four Portrait poses explicitly include raised/folded arms and hands. Pose wording, IDs, categories, ready images and finished runs are not rewritten. No generation was submitted as part of validation.
