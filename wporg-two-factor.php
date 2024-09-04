<?php

/**
 * Plugin Name: WordPress.org Two-Factor
 * Description: WordPress.org-specific customizations for the Two Factor plugin.
 * License:     GPLv2 or later
 * Text Domain: wporg
 * Network:     true
 * Update URI:  false
 */

namespace WordPressdotorg\Two_Factor;
use Two_Factor_Core, Two_Factor_Backup_Codes;
use WildWolf\WordPress\TwoFactorWebAuthn\Plugin as WebAuthn_Plugin;
use WildWolf\WordPress\TwoFactorWebAuthn\Constants as WebAuthn_Plugin_Constants;
use WP_User, WP_Error;

defined( 'WPINC' ) || die();

/**
 * todo remove this when launch for all users.
 * @codeCoverageIgnore
 */
function is_2fa_beta_tester( $user = false ) : bool {
	$user         = $user ?: wp_get_current_user();
	$beta_testers = array( 'dd32', 'paulkevan', 'tellyworth', 'jeffpaul', 'bengreeley', 'dufresnesteven' );

	return in_array( $user->user_login, $beta_testers, true );
}

require_once __DIR__ . '/settings/settings.php';
require_once __DIR__ . '/stats.php';

/**
 * Load the WebAuthn plugin.
 *
 * Make sure the WebAuthn plugin loads early, because all of our functions that call
 * `Two_Factor_Core::is_user_using_two_factor()` etc assume that all providers are loaded. If WebAuthn is loaded
 * too late, then `remove_capabilities_until_2fa_enabled()` would cause `get_enable_2fa_notice()` to be shown on
 * the front end if WebAuthn is enabled and TOTP isn't.
 *
 * @codeCoverageIgnore
 */
function load_webauthn_plugin() {
	global $wpdb;

	// Bail if the WebAuthn plugin is unavailable.
	if ( ! class_exists( '\WildWolf\WordPress\TwoFactorWebAuthn\Plugin' ) ) {
		if ( 'production' === wp_get_environment_type() ) {
			trigger_error( 'Two Factor WebAuthn plugin missing.', E_USER_WARNING );
		}
		return;
	}
	
	$webauthn = WebAuthn_Plugin::instance();
	$webauthn->init();

	// Use central WebAuthn tables, instead of ones for each site that shares our user tables.
	$wpdb->webauthn_credentials = 'wporg_' . WebAuthn_Plugin_Constants::WA_CREDENTIALS_TABLE_NAME;
	$wpdb->webauthn_users       = 'wporg_' . WebAuthn_Plugin_Constants::WA_USERS_TABLE_NAME;

	// The schema update checks should not check for updates on every request.
	remove_action( 'plugins_loaded', [ $webauthn, 'maybe_update_schema' ] );

	// The schema update checks do need occur, but only on admin requests on the main network.
	if ( 'wporg_' === $wpdb->base_prefix || 'local' === wp_get_environment_type() ) {
		add_action( 'admin_init', [ $webauthn, 'maybe_update_schema' ] );
	}
}
load_webauthn_plugin();

add_filter( 'two_factor_providers', __NAMESPACE__ . '\two_factor_providers', 99 ); // Must run _after_ all other plugins.
add_filter( 'two_factor_enabled_providers_for_user', __NAMESPACE__ . '\require_ordinary_provider', 99, 2 ); // Must run _after_ all other plugins.
add_filter( 'two_factor_primary_provider_for_user', __NAMESPACE__ . '\set_primary_provider_for_user', 10, 2 );
add_filter( 'two_factor_totp_issuer', __NAMESPACE__ . '\set_totp_issuer' );
add_action( 'set_current_user', __NAMESPACE__ . '\remove_super_admins_until_2fa_enabled', 1 ); // Must run _before_ all other plugins.
add_action( 'login_redirect', __NAMESPACE__ . '\redirect_to_2fa_settings', 105, 3 ); // After `wporg_remember_where_user_came_from_redirect()`, before `WP_WPorg_SSO::redirect_to_policy_update()`.
add_action( 'user_has_cap', __NAMESPACE__ . '\remove_capabilities_until_2fa_enabled', 99, 4 ); // Must run _after_ all other plugins.
add_action( 'current_screen', __NAMESPACE__ . '\block_webauthn_settings_page' );

/**
 * Determine which providers should be available to users.
 */
function two_factor_providers( array $providers ) : array {
	// Match the name => file path format of input var, but the path isn't needed.
	$desired_providers = array(
		'TwoFactor_Provider_WebAuthn' => '',
		'Two_Factor_Totp'         => '',
		'Two_Factor_Backup_Codes' => '',
	);

	return array_intersect_key( $providers, $desired_providers );
}

/**
 * Disable Backup Codes until an ordinary provider has been enabled.
 *
 * They should only be a fallback for when the user can't access their ordinary device (WebAuthn or TOTP). An
 * ordinary provider is one that is meant to be used daily, rather than a fallback method that is only used when
 * an ordinary device is lost/stolen/etc.
 *
 * @see set_primary_provider_for_user()
 */
function require_ordinary_provider( array $enabled_providers, int $user_id ) : array {
	$user = get_userdata( $user_id );

	// They were active at one point, but were then disabled (probably by this function).
	$has_inactive_backup_codes = ! in_array( 'Two_Factor_Backup_Codes', $enabled_providers, true ) &&
		Two_Factor_Backup_Codes::codes_remaining_for_user( $user ) > 0;

	if ( has_ordinary_provider( $enabled_providers ) ) {
		if ( $has_inactive_backup_codes ) {
			$enabled_providers[] = 'Two_Factor_Backup_Codes';
		}
	} else {
		$enabled_providers = array();
	}

	return $enabled_providers;
}

/**
 * Check if the user has an ordinary provider enabled.
 *
 * @see require_ordinary_provider()
 */
function has_ordinary_provider( array $enabled_providers ) : bool {
	return in_array( 'TwoFactor_Provider_WebAuthn', $enabled_providers, true ) ||
		in_array( 'Two_Factor_Totp', $enabled_providers, true );
}

/**
 * Set the primary provider to one that is strong and ordinary.
 *
 * @see require_ordinary_provider()
 */
function set_primary_provider_for_user( string $provider, int $user_id ) : string {
	$user                = get_user_by( 'id', $user_id );
	$available_providers = Two_Factor_Core::get_available_providers_for_user( $user );

	if ( isset( $available_providers['TwoFactor_Provider_WebAuthn'] ) ) {
		$provider = 'TwoFactor_Provider_WebAuthn';
	} elseif ( isset( $available_providers['Two_Factor_Totp'] ) ) {
		$provider = 'Two_Factor_Totp';
	} else {
		// Backup Codes should only be a fallback for when the user can't access their WebAuthn or TOTP device.
		$provider = '';
	}

	return $provider;
}

/**
 * Set the issuer for the entry in the user's TOTP app.
 *
 * @codeCoverageIgnore
 */
function set_totp_issuer( string $title ) : string {
	return 'WordPress.org';
}

/**
 * Remove a user's Super Admins status if they don't have 2FA enabled.
 *
 * This is needed in addition to `remove_capabilities_until_2fa_enabled()` for two reasons:
 *     1: To protect against code that calls `is_super_admin()` directly, instead of checking capabilities.
 *     2: To avoid the code in `has_cap()` that allows Super Admins to do anything unless `do_not_allow` is set.
 *        That would interfere with reducing their capabilities to a Subscriber in `remove_capabilities_until_2fa_enabled()`.
 */
function remove_super_admins_until_2fa_enabled() : void {
	global $super_admins;

	if ( empty( $super_admins ) ) {
		return;
	}

	$user     = wp_get_current_user();
	$position = array_search( $user->user_login, $super_admins, true );

	if ( false === $position ) {
		return;
	}

	if ( user_requires_2fa( $user ) && ! Two_Factor_Core::is_user_using_two_factor( $user->ID ) ) {
		unset( $super_admins[ $position ] );
	}
}

/**
 * Remove capabilities when a user with elevated privileges hasn't enabled 2FA.
 *
 * That is necessary even though we'll redirect all requests to their profile, because otherwise they could still
 * perform privileged actions on the front end, via the REST API, etc.
 */
function remove_capabilities_until_2fa_enabled( array $allcaps, array $caps, array $args, WP_User $user ) : array {
	if ( 0 === $user->ID || ! user_requires_2fa( $user ) ) {
		return $allcaps;
	}

	if ( ! Two_Factor_Core::is_user_using_two_factor( $user->ID ) ) {
		// This also relies on `remove_super_admins_until_2fa_enabled()`, see notes in that function.
		$allcaps = get_role( 'subscriber' )->capabilities;

		if ( function_exists( 'bbp_is_user_inactive' ) && ! bbp_is_user_inactive( $user->ID ) ) {
			$allcaps = array_merge( $allcaps, bbp_get_caps_for_role( bbp_get_participant_role() ) );
			$allcaps['read_private_forums'] = false;
		}

		add_action( 'admin_notices', __NAMESPACE__ . '\render_2fa_admin_notice' );
		add_filter( 'wporg_global_header_alert_markup', __NAMESPACE__ . '\get_enable_2fa_notice' );
	}

	return $allcaps;
}

/**
 * Check if the user has enough elevated privileges to require 2FA.
 *
 * @param WP_User $user
 */
function user_requires_2fa( $user ) : bool {
	global $trusted_deputies, $wcorg_subroles;

	// This shouldn't happen, but there've been a few times where it has inexplicably.
	if ( ! $user instanceof WP_User ) {
		return false;
	}

	// @codeCoverageIgnoreStart
	if ( ! array_key_exists( 'phpunit_version', $GLOBALS ) ) {
		// 2FA is opt-in during beta testing.
		// todo Remove this once we open it to all users.
		if ( ! is_2fa_beta_tester( $user ) ) {
			return false;
		}
	}
	// @codeCoverageIgnoreEnd

	$required = false;

	if ( is_special_user( $user->ID ) ) {
		$required = true;
	} elseif ( $trusted_deputies && in_array( $user->ID, $trusted_deputies, true ) ) {
		$required = true;
	} elseif ( $wcorg_subroles && array_key_exists( $user->ID, $wcorg_subroles ) ) {
		$required = true;
	}

	return $required;
}

/**
 * Check if the user *should* have 2FA enabled.
 * This is not *required* yet, but highly encouraged.
 *
 * @param WP_User $user
 */
function user_should_2fa( $user ) : bool {
	global $trusted_deputies, $wcorg_subroles;

	// This shouldn't happen, but there've been a few times where it has inexplicably.
	if ( ! $user instanceof WP_User ) {
		return false;
	}

	// If they require it, they should have it.
	// This duplicates the logic in `user_requires_2fa()`, due to the other uses of that function..
	if ( is_special_user( $user->ID ) ) {
		return true;
	} elseif ( $trusted_deputies && in_array( $user->ID, $trusted_deputies, true ) ) {
		return true;
	} elseif ( $wcorg_subroles && array_key_exists( $user->ID, $wcorg_subroles ) ) {
		return true;
	}

	/*
	// If a user ... they should have 2FA enabled.
	if (
		// Is (or was) a plugin committer
		$user->has_plugins ||
		// Has (or had) a live theme
		$user->has_themes ||
		// Has (or had) an elevated role on a site (WordPress.org, BuddyPress.org, bbPress.org, WordCamp.org)
		$user->has_elevated_role
	) {
		return true;
	}
 	*/

	return false;
}

/**
 * Redirect a user to their 2FA settings if they need to enable it.
 *
 * This isn't usually necessary, since WordPress will prevent Subscribers from visiting other Core screens, but
 * sometimes plugins add screens that are available to Subscribers (either intentionally or not).
 *
 * @param WP_User|WP_Error $user
 */
function redirect_to_2fa_settings( string $redirect_to, string $requested_redirect_to, $user ) : string {
	if ( is_wp_error( $user ) ) {
		return $redirect_to;
	}

	if ( ! user_requires_2fa( $user ) || Two_Factor_Core::is_user_using_two_factor( $user->ID ) ) {
		return $redirect_to;
	}

	return get_onboarding_account_url();
}

/**
 * Inform the user that they need to enable 2FA.
 *
 * @codeCoverageIgnore
 */
function render_2fa_admin_notice() : void {
	?>

	<div class="notice notice-error">
		<p>
			<?php echo wp_kses_post( get_enable_2fa_notice() ); ?>
		</p>
	</div>

	<?php
}

/**
 * Get the notice for enabling 2FA.
 *
 * When used as a filter callback, this will prepend the 2FA notice to others notices.
 *
 * @codeCoverageIgnore
 */
function get_enable_2fa_notice( string $existing_notices = '' ) : string {
	$two_factor_notice = sprintf(
		__(
			'Your account has elevated privileges and requires extra security before you can continue. Please <a href="%s">enable two-factor authentication</a>.',
			'wporg'
		),
		get_onboarding_account_url()
	);

	return $two_factor_notice . $existing_notices;
}

/*
 * Remove the 2FA settings page from the admin menu.
 *
 * We don't want site admins making changes, etc.
 *
 * @codeCoverageIgnore
 */
function block_webauthn_settings_page() {
	$screen = get_current_screen();

	// Prevent direct access.
	if ( $screen->id === 'settings_page_2fa-webauthn' ) {
		wp_die( 'Access Denied.' );
	}

	remove_submenu_page( 'options-general.php', '2fa-webauthn' );
}

/**
 * Get the URL of the Edit Account screen.
 *
 * @codeCoverageIgnore
 *
 * @param int|WP_User $user Optional. The user to get the URL for. Default is the current user.
 * @return string
 */
function get_edit_account_url( $user = false ) : string {
	if ( ! $user ) {
		$user = wp_get_current_user();
	} elseif ( is_numeric( $user ) ) {
		$user = get_user_by( 'id', $user );
	}

	return 'https://profiles.wordpress.org/' . ( $user->user_nicename ?? 'me' ) . '/profile/edit/group/3/';
}

/**
 * Get the URL of the onboarding screen.
 *
 * @codeCoverageIgnore
 *
 * @param int|WP_User $user Optional. The user to get the URL for. Default is the current user.
 * @return string
 */
function get_onboarding_account_url( $user = false ) : string {
	if ( ! $user ) {
		$user = wp_get_current_user();
	} elseif ( is_numeric( $user ) ) {
		$user = get_user_by( 'id', $user );
	}

	return 'https://profiles.wordpress.org/' . ( $user->user_nicename ?? 'me' ) . '/profile/security';
}

/**
 * Called after a provider is setup, such that we can bump the revalidation and/or flag the 2fa session.
 *
 * @param int $user_id
 * @param string|null $provider
 */
function after_provider_setup( $user_id, $provider ) {
	$user_id = intval( $user_id );

	if ( $user_id !== get_current_user_id() ) {
		return;
	}

	// Bump session revalidation upon it being setup, or a new key configured.
	Two_Factor_Core::update_current_user_session( [
		'two-factor-provider' => $provider->get_key(),
		'two-factor-login'    => time(),
	] );
}

/**
 * Called after a provider is deactivated, such that deactivate a 2fa session if required.
 *
 * @param int $user_id
 * @param string|null $provider
 */
function after_provider_deactivated( $user_id, $provider = null ) {
	$user_id = intval( $user_id );

	if ( $user_id !== get_current_user_id() ) {
		return;
	}

	if ( ! Two_Factor_Core::is_current_user_session_two_factor() ) {
		return;
	}

	$available_providers = Two_Factor_Core::get_available_providers_for_user( $user_id );

	// Workaround until #164 lands.
	unset( $available_providers['Two_Factor_Backup_Codes'] );

	// If they no longer have 2FA providers setup, remove the session meta.
	if ( ! $available_providers ) {
		Two_Factor_Core::update_current_user_session( [
			'two-factor-provider' => null,
			'two-factor-login'    => null,
		] );
	}
}

/*
 * Switch out the TOTP provider for one that encrypts the TOTP key.
 */
add_filter( 'two_factor_provider_classname_Two_Factor_Totp', function( string $provider ) : string {
	require_once __DIR__ . '/class-encrypted-totp-provider.php';

	return __NAMESPACE__ . '\Encrypted_Totp_Provider';
} );

/*
 * Switch out the WebAuthN provider for one that uses a tiny bit of caching.
 */
add_filter( 'two_factor_provider_classname_TwoFactor_Provider_WebAuthn', function( string $provider ) : string {
	require_once __DIR__ . '/class-wporg-webauthn-provider.php';

	return __NAMESPACE__ . '\WPORG_TwoFactor_Provider_WebAuthn';
} );
