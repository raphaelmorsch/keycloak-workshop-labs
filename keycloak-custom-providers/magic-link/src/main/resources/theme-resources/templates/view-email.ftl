<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=false; section>
    <#if section = "title">
        ${msg("loginTitle",(realm.displayName!''))}
    <#elseif section = "header">
        ${msg("loginTitleHtml",(realm.displayNameHtml!''))?no_esc}
    <#elseif section = "form">
        <div id="kc-info-message">
            <p class="instruction">An email with a magic link has been sent to you. Click the link in the email to sign in.</p>
        </div>
    </#if>
</@layout.registrationLayout>
