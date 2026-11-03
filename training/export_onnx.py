"""Export a trained NPC for the browser: the policy's action scores as ONNX, read by onnxruntime-web in the game.

The model takes 'observation' [1, size] and gives 'logits' [1, actions]. The game masks illegal actions itself
and picks the best one that's left, as MaskablePPO's deterministic predict does.
Run: $PY training/export_onnx.py training/models/<name>.zip public/models/npc.onnx
"""
import argparse
import json
import pathlib

import torch
from sb3_contrib import MaskablePPO


class Logits(torch.nn.Module):
    def __init__(self, policy):
        super().__init__()
        self.policy = policy

    def forward(self, observation):
        features = self.policy.extract_features(observation, self.policy.pi_features_extractor)
        latent_pi = self.policy.mlp_extractor.forward_actor(features)
        return self.policy.action_net(latent_pi)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=pathlib.Path)
    parser.add_argument("out", type=pathlib.Path)
    args = parser.parse_args()
    model = MaskablePPO.load(args.model, device="cpu")
    size = model.observation_space.shape[0]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    torch.onnx.export(Logits(model.policy).eval(), torch.zeros(1, size), str(args.out),
                      input_names=["observation"], output_names=["logits"], opset_version=17, dynamo=False)
    description = args.model.with_suffix(".json")
    meta = json.loads(description.read_text()) if description.exists() else {}
    args.out.with_suffix(".json").write_text(json.dumps({"observationSize": size, "from": args.model.name, **meta}, indent=2))
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
