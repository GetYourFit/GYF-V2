import { ScrollViewStyleReset, useServerDocumentContext } from "expo-router/html";
import type { ReactNode } from "react";

import { buildCuelinksWebLoaderScript, cuelinksWebConfig } from "../lib/cuelinks-web";

type RootHtmlProps = {
  children: ReactNode;
};

export default function RootHtml({ children }: RootHtmlProps) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();
  const cuelinksLoaderScript = buildCuelinksWebLoaderScript(cuelinksWebConfig.cid);

  return (
    <html {...htmlAttributes} lang={htmlAttributes?.lang ?? "en"}>
      <head>
        <ScrollViewStyleReset />
        <meta name="gyf-cuelinks-web-cid" content={cuelinksWebConfig.cid} />
        <meta name="gyf-cuelinks-web-script" content="cuelinksv2.js" />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
        <script
          id="gyf-cuelinks-web-loader"
          type="text/javascript"
          data-gyf-cuelinks-web="true"
          data-cuelinks-cid={cuelinksWebConfig.cid}
          dangerouslySetInnerHTML={{ __html: cuelinksLoaderScript }}
        />
      </body>
    </html>
  );
}
