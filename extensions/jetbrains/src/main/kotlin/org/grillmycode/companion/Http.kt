package org.grillmycode.companion

import com.intellij.util.io.HttpRequests
import org.grillmycode.companion.shared.HttpResponse
import java.net.HttpURLConnection

/**
 * The [org.grillmycode.companion.shared.HttpGet] the plugin passes to shared/:
 * a GET through the IDE's proxy settings, which answers with the status and the
 * body rather than throwing on a status that is not 200.
 */
fun httpGet(
    url: String,
    headers: Map<String, String>,
): HttpResponse =
    HttpRequests
        .request(url)
        .productNameAsUserAgent()
        .throwStatusCodeException(false)
        .tuner { connection -> headers.forEach(connection::setRequestProperty) }
        .connect { request ->
            val connection = request.connection as HttpURLConnection
            val status = connection.responseCode
            // A refusal's body is GitHub's reason, which says, for one, when an organization has not approved the app.
            val body = if (status == 200) request.readString() else connection.errorStream?.use { String(it.readBytes()) }.orEmpty()
            HttpResponse(status, body)
        }
