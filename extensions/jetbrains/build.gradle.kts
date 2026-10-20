import org.jetbrains.changelog.Changelog
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
        // oldest supported IDE ships: 2025.1 bundles Kotlin 2.1.
        apiVersion = KotlinVersion.KOTLIN_2_1
        languageVersion = KotlinVersion.KOTLIN_2_1
    }
}

dependencies {
    intellijPlatform {
        intellijIdeaCommunity(providers.gradleProperty("platformVersion"))
    }
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
