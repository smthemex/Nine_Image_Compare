import nodes
from typing_extensions import override
from comfy_api.latest import IO, ComfyExtension


# Edit from comfyUI nodes_image_compare.py
class NineImageCompare(IO.ComfyNode):
    """Compares two images with a slider interface."""

    @classmethod
    def define_schema(cls):
        compare_inputs = [IO.Image.Input(f"compare_image_{i}", optional=True) for i in range(1, 10)]
        return IO.Schema(
            node_id="NineImageCompare",
            display_name="Compare Nine Images",
            description="Compares one reference image with nine other images using a vertical slider.",
            category="image",
            essentials_category="Image Tools",
            is_experimental=True,
            is_output_node=True,
            inputs=[
                IO.Image.Input("reference_image", optional=True),
                *compare_inputs,
            ],
            outputs=[],
        )

    @classmethod
    def execute(cls, reference_image=None, **kwargs) -> IO.NodeOutput:
        result = {"ref_image": [], "compare_images": []}

        preview_node = nodes.PreviewImage()

        if reference_image is not None and len(reference_image) > 0:
            saved = preview_node.save_images(reference_image, "comfy.compare.ref")
            result["ref_image"] = saved["ui"]["images"]

        for i in range(1, 10):
            image = kwargs.get(f"compare_image_{i}")
            if image is not None and len(image) > 0:
                saved = preview_node.save_images(image, f"comfy.compare.{i}")
                result["compare_images"].append(saved["ui"]["images"])
            else:
                result["compare_images"].append([])

        return IO.NodeOutput(ui=result)


WEB_DIRECTORY = "./js"

class NineImageCompareExtension(ComfyExtension):
    @override
    async def get_node_list(self) -> list[type[IO.ComfyNode]]:
        return [
            NineImageCompare,
        ]


async def comfy_entrypoint() -> NineImageCompareExtension:
    return NineImageCompareExtension()


