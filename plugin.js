function getMemberType(member) {
    if (
      member.value &&
      member.value.type === "CallExpression" &&
      member.value.callee &&
      member.value.callee.type === "Identifier"
    ) {
      const calleeName = member.value.callee.name;
      if (calleeName === "input") return "input";
      if (calleeName === "output") return "output";
      if (calleeName === "inject") return "inject";
    }
  
    if (
      member.value &&
      member.value.type === "CallExpression" &&
      member.value.callee &&
      member.value.callee.type === "MemberExpression" &&
      member.value.callee.object &&
      member.value.callee.object.type === "Identifier" &&
      member.value.callee.object.name === "input" &&
      member.value.callee.property &&
      member.value.callee.property.type === "Identifier" &&
      member.value.callee.property.name === "required"
    ) {
      return "input.required";
    }
  
    return "other";
  }
  
  /** @type {import("@typescript-eslint/utils").TSESLint.RuleModule} */
  const angularMemberOrderingRule = {
    defaultOptions: [
      {
        order: ["inject", "input", "input.required", "output", "other"], // Default order
        logging: false,
      },
    ],
    meta: {
      type: "suggestion",
      docs: {
        description:
          "Ensure Angular 18+ members (input/output/inject) are correctly ordered",
        category: "Stylistic Issues",
        recommended: false,
      },
      fixable: "code", // enables auto-fixing
      schema: [
        {
          type: "object",
          properties: {
            order: {
              type: "array",
              items: {
                type: "string",
                enum: ["input", "input.required", "output", "inject", "other"],
              },
              uniqueItems: true,
              minItems: 5,
              maxItems: 5,
            },
            logging: { type: "boolean" },
          },
          additionalProperties: false,
        },
      ],
      messages: {
        incorrectOrder:
          "{{ member }} should be declared before {{ previousMember }}.",
      },
    },
  
    create(context) {
      const sourceCode = context.sourceCode;
  
      return {
        ClassBody(node) {
          const members = node.body;
          const options = context.options[0] || {};
          const customOrder = options.order || [
            "inject",
            "input",
            "input.required",
            "output",
            "other",
          ];
          const loggingEnabled = options.logging ?? false;
  
          const order = Object.fromEntries(
            customOrder.map((key, index) => [key, index])
          );
  
          let lastSeenOrder = -1;
          let fixes = [];
  
          for (let i = 0; i < members.length; i++) {
            const member = members[i];
  
            if (
              member.type !== "PropertyDefinition" &&
              member.type !== "MethodDefinition"
            )
              continue;
  
            let memberType = getMemberType(member);
  
            const currentOrder = order[memberType];
  
            if (loggingEnabled) {
              console.debug(
                `[ESLint Plugin] Checking member '${sourceCode.getText(
                  member
                )}' as '${memberType}' (order: ${currentOrder})`
              );
            }
  
            if (currentOrder < lastSeenOrder) {
              if (loggingEnabled) {
                console.warn(
                  `[ESLint Plugin] ❌ Incorrect order: '${memberType}' should be before '${Object.keys(
                    order
                  ).find((key) => order[key] === lastSeenOrder)}'`
                );
              }
  
              context.report({
                node: member,
                messageId: "incorrectOrder",
                data: {
                  member: memberType,
                  previousMember: Object.keys(order).find(
                    (key) => order[key] === lastSeenOrder
                  ),
                },
                fix: (fixer) => {
                  fixes.push(member);
                  if (i === members.length - 1) {
                    return fixer.replaceTextRange(
                      [members[0].range[0], members[members.length - 1].range[1]],
                      fixes
                        .sort(
                          (a, b) =>
                            order[getMemberType(a)] - order[getMemberType(b)]
                        )
                        .map((m) => sourceCode.getText(m))
                        .join("\n\n")
                    );
                  }
                },
              });
            } else {
              if (loggingEnabled) {
                console.debug(
                  `[ESLint Plugin] ✅ Order is correct for '${memberType}'`
                );
              }
            }
            lastSeenOrder = currentOrder;
          }
        },
      };
    },
  };
  
  module.exports = {
    meta: {
      name: "eslint-plugin-angular-mc",
      version: "1.0.0",
    },
    rules: {
      "angular-member-ordering": angularMemberOrderingRule,
    },
  };
  