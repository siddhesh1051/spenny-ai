import React from "react";
import type { UiNode, UiRendererCallbacks } from "./types";
import { Block } from "./nodes/Block";
import { Summary } from "./nodes/Summary";
import { Visual } from "./nodes/Visual";
import { Table } from "./nodes/Table";
import { Collection } from "./nodes/Collection";
import { Row } from "./nodes/Row";
import { Column } from "./nodes/Column";

export function renderNode(
  node: UiNode,
  key: React.Key,
  callbacks?: UiRendererCallbacks,
): React.ReactNode {
  switch (node.kind) {
    case "column":
      return (
        <Column
          key={key}
          node={node}
          renderNode={renderNode}
          callbacks={callbacks}
        />
      );
    case "row":
      return (
        <Row
          key={key}
          node={node}
          renderNode={renderNode}
          callbacks={callbacks}
        />
      );
    case "block":
      return <Block key={key} node={node} />;
    case "summary":
      return <Summary key={node.id} node={node} />;
    case "visual":
      return <Visual key={key} node={node} />;
    case "table":
      return <Table key={key} node={node} />;
    case "collection":
      return <Collection key={key} node={node} callbacks={callbacks} />;
    default:
      return null;
  }
}
