import ts from "byots";
import luau from "LuauAST";
import { diagnostics } from "Shared/diagnostics";
import { TransformState } from "TSTransformer";
import { transformOptionalChain } from "TSTransformer/nodes/transformOptionalChain";
import { convertToIndexableExpression } from "TSTransformer/util/convertToIndexableExpression";
import { isMethod } from "TSTransformer/util/isMethod";
import { skipUpwards } from "TSTransformer/util/traversal";
import { getFirstDefinedSymbol } from "TSTransformer/util/types";
import { validateNotAnyType } from "TSTransformer/util/validateNotAny";

export function transformPropertyAccessExpressionInner(
	state: TransformState,
	node: ts.PropertyAccessExpression,
	expression: luau.Expression,
	name: string,
) {
	validateNotAnyType(state, node.expression);

	const symbol = getFirstDefinedSymbol(state, state.getType(node));
	if (symbol) {
		if (state.macroManager.getPropertyCallMacro(symbol)) {
			state.addDiagnostic(diagnostics.noMacroWithoutCall(node));
			return luau.emptyId();
		}
	}

	if (isMethod(state, node)) {
		state.addDiagnostic(diagnostics.noIndexWithoutCall(node));
		return luau.emptyId();
	}

	if (ts.isPrototypeAccess(node)) {
		state.addDiagnostic(diagnostics.noPrototype(node));
	}

	const constantValue = state.typeChecker.getConstantValue(node);
	if (constantValue !== undefined) {
		return typeof constantValue === "string" ? luau.string(constantValue) : luau.number(constantValue);
	}

	const parent = skipUpwards(node).parent;
	if (ts.isDeleteExpression(parent)) {
		state.prereq(
			luau.create(luau.SyntaxKind.Assignment, {
				left: luau.create(luau.SyntaxKind.PropertyAccessExpression, {
					expression: convertToIndexableExpression(expression),
					name,
				}),
				operator: "=",
				right: luau.nil(),
			}),
		);
		return luau.nil();
	}

	return luau.create(luau.SyntaxKind.PropertyAccessExpression, {
		expression: convertToIndexableExpression(expression),
		name,
	});
}

export function transformPropertyAccessExpression(state: TransformState, node: ts.PropertyAccessExpression) {
	return transformOptionalChain(state, node);
}
