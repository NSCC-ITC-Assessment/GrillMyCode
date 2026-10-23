import org.jetbrains.changelog.Changelog
import org.jetbrains.intellij.platform.gradle.TestFrameworkType
import org.jetbrains.kotlin.gradle.dsl.JvmDefaultMode
import org.jetbrains.kotlin.gradle.dsl.KotlinVersion

plugins {
    id("org.jetbrains.kotlin.jvm")
    id("org.jetbrains.intellij.platform")
    id("org.jetbrains.changelog")
    id("org.jlleitschuh.gradle.ktlint")
}

kotlin {
    // The IntelliJ Platform runs on Java 21 from 2024.2.
    jvmToolchain(21)
    compilerOptions {
        // The standard library is the IDE's, so code may use only what the
        // oldest supported IDE ships: 2025.1 bundles Kotlin 2.1. The language
        // version can be newer; the compiler keeps to this API either way.
        apiVersion = KotlinVersion.KOTLIN_2_1
        // A class implementing one of the IDE's Kotlin interfaces inherits its
        // default methods, rather than getting a copy of each that calls the
        // interface. Those copies count as calls to every one of them, and the
        // verifier reports any that are deprecated or internal.
        jvmDefault = JvmDefaultMode.NO_COMPATIBILITY
    }
}

dependencies {
    intellijPlatform {
        intellijIdeaCommunity(providers.gradleProperty("platformVersion"))
        // Remotes and the branch, as VS Code's built-in Git extension gives them.
        bundledPlugin("Git4Idea")
        // Workflow files are YAML; the workflow help works on them.
        bundledPlugin("org.jetbrains.plugins.yaml")
        // A light IDE for the tests of the workflow help in the editor.
        testFramework(TestFrameworkType.Platform)
    }

    // Reads workflow files for the workflow help, with where each value is. The
    // IDE has a copy of its own, but not as an API a plugin may rely on.
    implementation("org.snakeyaml:snakeyaml-engine:2.9")

    // Plain unit tests, for the code in shared/ that needs no running IDE.
    testImplementation(platform("org.junit:junit-bom:6.1.3"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
    // The IDE's test runtime loads JUnit 4 classes even for JUnit 5 tests, and
    // its light fixtures are JUnit 4 tests, which the vintage engine runs.
    testImplementation("junit:junit:4.13.2")
    testRuntimeOnly("org.junit.vintage:junit-vintage-engine")
}

// The Workflow Wizard's page: the docs site's Wizard, bundled by the VS Code
// extension's esbuild.js exactly as it bundles it for VS Code, so there is one
// Wizard to keep. Needs Node, and extensions/vscode's packages installed:
// `pnpm install` there first.
val wizardBundle = layout.buildDirectory.dir("wizard")
val buildWizard by tasks.registering(Exec::class) {
    val vscode = layout.projectDirectory.dir("../vscode")
    val docs = layout.projectDirectory.dir("../../docs-site")
    workingDir(vscode)
    commandLine("node", "esbuild.js", "--production", "--wizard-out=${wizardBundle.get().asFile.absolutePath}")
    inputs.dir(docs.dir("docs/_workflow-wizard")).withPropertyName("wizard")
    inputs.dir(docs.dir("static/img")).withPropertyName("images")
    inputs.dir(vscode.dir("src/webview")).withPropertyName("webview")
    inputs.dir(vscode.dir("src/shared")).withPropertyName("shared")
    inputs.files(vscode.file("esbuild.js"), vscode.file("pnpm-lock.yaml")).withPropertyName("build")
    outputs.dir(wizardBundle)
}

tasks.processResources {
    from(buildWizard) { into("wizard") }
}

tasks.test {
    useJUnitPlatform()
    // The sample issues every editor's reader is tested against. An input, so
    // the tests run again when one changes.
    val fixtures = layout.projectDirectory.dir("../fixtures")
    inputs.dir(fixtures).withPropertyName("fixtures")
    systemProperty("gmc.fixtures", fixtures.asFile.absolutePath)
    // The workflows the documentation shows, which the input checks must
    // have nothing to say about.
    val repository = layout.projectDirectory.dir("../..")
    inputs.dir(repository.dir("docs-site/docs")).withPropertyName("docs")
    inputs.file(repository.file("README.md")).withPropertyName("readme")
    systemProperty("gmc.repository", repository.asFile.absolutePath)
}

changelog {
    groups.empty()
    repositoryUrl = "https://github.com/NSCC-ITC-Assessment/GrillMyCode"
}

intellijPlatform {
    pluginConfiguration {
        version = providers.gradleProperty("version")

        // The Marketplace shows these on the listing's "What's New" tab. A
        // local, so the lambda captures the extension and not the build
        // script, which Gradle's configuration cache cannot store.
        val changelogExtension = changelog
        changeNotes =
            providers.gradleProperty("version").map { version ->
                with(changelogExtension) {
                    renderItem(
                        (getOrNull(version) ?: getUnreleased())
                            .withHeader(false)
                            .withEmptySections(false),
                        Changelog.OutputType.HTML,
                    )
                }
            }

        ideaVersion {
            sinceBuild = providers.gradleProperty("pluginSinceBuild")
            // No upper bound: a new IDE release does not need a new plugin
            // release first. The verifier checks the latest IDEs instead.
            untilBuild = providers.provider { null }
        }
    }

    // Read from the release workflow's environment. Without them, building
    // and verifying still work; only signPlugin and publishPlugin fail.
    signing {
        certificateChain = providers.environmentVariable("CERTIFICATE_CHAIN")
        privateKey = providers.environmentVariable("PRIVATE_KEY")
        password = providers.environmentVariable("PRIVATE_KEY_PASSWORD")
    }

    publishing {
        token = providers.environmentVariable("PUBLISH_TOKEN")
        // 0.1.0-eap.1 goes to the "eap" channel, 0.2.0 to the default one.
        channels =
            providers.gradleProperty("version").map {
                listOf(it.substringAfter('-', "").substringBefore('.').ifEmpty { "default" })
            }
    }

    pluginVerification {
        ides {
            // The IDEs JetBrains recommends checking, worked out from the
            // supported builds: from the oldest (2025.1) to the latest
            // release and EAP, Community and Ultimate.
            recommended()
        }
    }
}
