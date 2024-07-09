<?php
namespace WordPressdotorg\Two_Factor;
use Two_Factor_Core;

defined( 'WPINC' ) || die();

/**
 * Get the revalidation status for the current user, aka "sudo mode".
 *
 * @return array {
 *    @type int  $last_validated   The timestamp of the last time the user was validated.
 *    @type int  $expires_at       The timestamp when the current validation expires.
 *    @type bool $needs_revalidate Whether the user needs to revalidate.
 * }
 */
function get_revalidation_status() {
	$last_validated = Two_Factor_Core::is_current_user_session_two_factor();
	$timeout        = apply_filters( 'two_factor_revalidate_time', 15 * MINUTE_IN_SECONDS, get_current_user_id(), '' );
	$expires_at     = $last_validated + $timeout;

	return [
		'last_validated'   => $last_validated,
		'expires_at'       => $expires_at,
		'needs_revalidate' => ( ! $last_validated || $expires_at < time() ),
	];
}

/**
 * Get the URL for revalidating 2FA, with a redirect parameter.
 *
 * @param string $redirect_to The URL to redirect to after revalidating.
 * @return string
 */
function get_revalidate_url( $redirect_to = '' ) {
	$url = Two_Factor_Core::get_user_two_factor_revalidate_url();
	if ( ! empty( $redirect_to ) ) {
		$url = add_query_arg( 'redirect_to', urlencode( $redirect_to ), $url );
	}

	return $url;
}

/**
 * Get the URL for revalidating 2FA via JavaScript.
 *
 * The calling code should be listening for a 'reValidationComplete' event.
 *
 * @param string $redirect_to The URL to redirect to after revalidating.
 * @return string
 */
function get_js_revalidation_url( $redirect_to = '' ) {
	$url = get_revalidate_url( $redirect_to );

	// Add some JS to the footer to handle the revalidate actions.
	add_action( 'wp_footer', __NAMESPACE__ . '\wp_footer_revalidate_modal' );

	return $url;
}

/**
 * Output the JavaScript & CSS for the revalidate modal.
 *
 * This is output to the footer of the page, and listens for clicks on revalidate links.
 * When a revalidate link is clicked, a modal dialog is opened with an iframe to the revalidate URL.
 * When the revalidation is complete, the dialog is closed and the calling code is notified via a 'reValidationComplete' event.
 */
function wp_footer_revalidate_modal() {
	?><script>(function(){
		let revalidateModal = false;
		let lastTarget = false;

		const modalTrigger = function(e) {
			e.preventDefault();
			lastTarget = e.target;

			// Remove the existing dialog from the DOM.
			if ( revalidateModal ) {
				revalidateModal.remove();
			}

			revalidateModal = document.createElement( 'dialog' );
			revalidateModal.className = 'wporg-2fa-revalidate-modal';
			revalidateModal.innerHTML = <?php echo wp_json_encode( '<h1>' . __( 'Two Factor Authentication', 'wporg' ) . '</h1>' ); ?>

			const iframe = document.createElement( 'iframe' );
			iframe.src = e.target.href + '&interim-login=1';

			const closeButton = document.createElement( 'button' );
			closeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M13 11.8l6.1-6.3-1-1-6.1 6.2-6.1-6.2-1 1 6.1 6.3-6.5 6.7 1 1 6.5-6.6 6.5 6.6 1-1z"></path></svg>';
			closeButton.addEventListener( 'click', function() {
				revalidateModal.close();
			} );

			revalidateModal.appendChild( iframe );
			revalidateModal.appendChild( closeButton );

			document.body.appendChild( revalidateModal );

			revalidateModal.showModal();
		};

		// Attach event listeners to all revalidate links
		document.querySelectorAll( 'a[href*=revalidate_2fa]' ).forEach( function( el ) {
			el.addEventListener( 'click', modalTrigger );
		} );

		// Listen for the revalidation to complete.
		window.addEventListener( 'message', function( event ) {
			if ( ! event.data || ! event.data.type || event.data.type !== 'reValidationComplete' ) {
				return;
			}
			revalidateModal.close();
			revalidateModal.remove();

			// Notify others.
			( lastTarget || window ).dispatchEvent( new Event( 'reValidationComplete', { bubbles: true } ) );
		} );
	})();</script>
	<style>
		dialog.wporg-2fa-revalidate-modal {
			border-radius: 8px;
		}
		dialog.wporg-2fa-revalidate-modal > h1 {
			margin: unset;
			margin-bottom: 1em;
			text-align: center;
		}
		dialog.wporg-2fa-revalidate-modal > iframe {
			width: 100%;
			height: 330px; /* Room for errors. */
			border: none;
		}
		/* Close button. */
		dialog.wporg-2fa-revalidate-modal > button {
			position: absolute;
			top: 0;
			right: 0;
			background: none;
			border: none;
			padding: 15px;
		}
	</style>
	<?php
}
