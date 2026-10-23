package org.grillmycode.companion.shared

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject

// The action's inputs
//
// What action.yml declares for each input, with what src/inputs.js accepts for
// it, read from action-inputs.json. That file is generated, with the VS Code
// extension's action-inputs.js, by scripts/build-extension-action-inputs.js.

/** What a value of an input may be. An input that is free text has [Free]. */
sealed interface InputRule {
    /** One of [values], in any letter case unless [caseSensitive]. [prefix] also allows that prefix and a tag name. */
    data class Enum(
        val values: List<String>,
        val caseSensitive: Boolean,
        val prefix: String?,
    ) : InputRule

    /** "true" or "false". [strict] says anything else fails the run; otherwise anything but "true" is false. */
    data class Bool(
        val strict: Boolean,
    ) : InputRule

    /** A whole number, clamped to [min] and [max]. */
    data class Integer(
        val min: Double,
        val max: Double?,
    ) : InputRule

    /** A number from [min] to [max]. Anything else is ignored. */
    data class Number(
        val min: Double,
        val max: Double,
    ) : InputRule

    /** A list of submission tag patterns. */
    data object Tags : InputRule

    /** A question set's name, which must be able to name a folder. Anything else fails the run. */
    data object QuestionSet : InputRule

    data object Free : InputRule
}

/** One input: what action.yml declares for it, and its rule. */
data class ActionInput(
    val description: String,
    val default: String,
    val required: Boolean,
    val deprecated: Boolean,
    val secret: Boolean,
    val replacement: String?,
    val hidden: Boolean,
    val rule: InputRule,
)

private fun JsonObject.text(name: String) = (this[name] as? JsonPrimitive)?.takeIf { it.isString }?.content

private fun JsonObject.flag(name: String) = (this[name] as? JsonPrimitive)?.booleanOrNull == true

private fun JsonObject.number(name: String) = (this[name] as? JsonPrimitive)?.doubleOrNull

private fun readRule(input: JsonObject): InputRule =
    when (input.text("kind")) {
        "enum" ->
            InputRule.Enum(
                input.getValue("values").jsonArray.map { (it as JsonPrimitive).content },
                input.flag("caseSensitive"),
                input.text("prefix"),
            )
        "boolean" -> InputRule.Bool(input.flag("strict"))
        "integer" -> InputRule.Integer(input.number("min") ?: 0.0, input.number("max"))
        "number" -> InputRule.Number(input.number("min") ?: 0.0, input.number("max") ?: 0.0)
        "tags" -> InputRule.Tags
        "questionSet" -> InputRule.QuestionSet
        else -> InputRule.Free
    }

/** Every input, in the order action.yml declares them. */
fun readActionInputs(json: String): Map<String, ActionInput> =
    Json.parseToJsonElement(json).jsonObject.mapValues { (_, element: JsonElement) ->
        val input = element.jsonObject
        ActionInput(
            description = input.text("description").orEmpty(),
            default = input.text("default").orEmpty(),
            required = input.flag("required"),
            deprecated = input.flag("deprecated"),
            secret = input.flag("secret"),
            replacement = input.text("replacement"),
            hidden = input.flag("hidden"),
            rule = readRule(input),
        )
    }

/** The inputs this version of the plugin knows, by name. */
val ACTION_INPUTS: Map<String, ActionInput> by lazy {
    val json =
        ActionInput::class.java.getResourceAsStream("/action-inputs.json")?.use { it.readBytes().decodeToString() }
            ?: error("action-inputs.json is missing from the plugin")
    readActionInputs(json)
}
