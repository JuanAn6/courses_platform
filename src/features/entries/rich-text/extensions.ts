import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import { safeHref } from "./sanitize";

/** The single set of rich-text extensions, shared by the editor and the server renderer. */
export const richTextExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      isAllowedUri: (url) => safeHref(url) !== null,
      HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" },
    },
  }),
  Image.configure({ inline: false, allowBase64: false }),
];
