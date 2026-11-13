@session
Feature: Signing in to the admin and the session
  The admin asks for an e-mail address and a password, keeps a session
  and ends it from the user menu.

  @critical
  Scenario: The owner signs in and out
    Given I am logged in to the admin as "owner"
    Then I should be logged in to the admin as "owner"
    And the user menu should show "owner@example.com"
    And the user menu should show "Olivia Owner"
    When I press the key "Escape"
    And I log out of the admin
    Then I should not be logged in to the admin
    And I should be on the admin screen "sign in"

  Scenario: A wrong password is refused
    When I try to log in to the admin with the email "owner@example.com" and the password "not-the-right-one"
    Then I should see the sign in error "Your password is incorrect."
    And I should not be logged in to the admin

  Scenario: An unknown address is refused
    When I try to log in to the admin with the email "nobody@example.com" and the password "Some-Test-Key-2026"
    Then I should see the sign in error "There is no user with that email address."
    And I should not be logged in to the admin

  Scenario: A visitor who asks for an admin screen is sent to the sign in form
    Given I am an anonymous user
    When I go to "/ghost/#/posts"
    Then I should be on the admin screen "sign in"

  Scenario: A scenario can change users
    Given I am logged in to the admin as "editor"
    Then I should be logged in to the admin as "editor"
    When I log in to the admin as "author"
    Then I should be logged in to the admin as "author"
    And the user menu should show "author@example.com"
