import org.jetbrains.changelog.Changelog
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
    }

    // Plain unit tests, for the code in shared/ that needs no running IDE.
    testImplementation(platform("org.junit:junit-bom:6.1.3"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
    // The IDE's test runtime loads JUnit 4 classes even for JUnit 5 tests.
    testRuntimeOnly("junit:junit:4.13.2")
}

tasks.test {
    useJUnitPlatform()
    // The sample issues every editor's reader is tested against. An input, so
    // the tests run again when one changes.
    val fixtures = layout.projectDirectory.dir("../fixtures")
    inputs.dir(fixtures).withPropertyName("fixtures")
    systemProperty("gmc.fixtures", fixtures.asFile.absolutePath)
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
