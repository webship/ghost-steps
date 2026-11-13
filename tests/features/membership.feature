@membership
Feature: The membership form: sign up, sign in and the account
  Visitors subscribe and sign in with a link the site e-mails. The test
  site sends its mail to a local mailbox, which the steps read.

  Scenario: The sign in form validates the e-mail address
    Given I am an anonymous user
    And I am on the homepage
    When I open the membership sign in form
    Then the membership form should show "Sign in"
    When I submit the membership form
    Then the membership form should show "Enter your email address"
    And the membership form should not show "Now check your email!"
    When I close the membership form
    Then I should not be signed in as a member

  Scenario: The sign up form validates its fields
    Given I am an anonymous user
    And I am on the homepage
    When I open the membership sign up form
    And I submit the membership form
    Then the membership form should show "Enter your name"
    And the membership form should show "Enter your email address"

  @critical
  Scenario: A member signs in with the link the site e-mails, reads a members-only post and signs out
    Given I am an anonymous user
    And the mailbox is empty
    When I go to "/members-only-notes/"
    Then the post should be restricted to members
    And I should not see "These notes are for members."
    When I open the membership sign in form
    And I fill in "Email" with "member@example.com" in the membership form
    And I submit the membership form
    Then the membership form should show "Now check your email!"
    And an e-mail with the subject "Sign in to Test site" should have been sent to "member@example.com"
    When I follow the link e-mailed to "member@example.com"
    Then I should be signed in as a member
    And I should be signed in as the member "member@example.com"
    And I should not see a subscribe button
    When I go to "/members-only-notes/"
    Then the post should not be restricted to members
    And I should see "These notes are for members."
    When I open the membership account form
    Then the membership form should show "Your account"
    And the membership form should show "member@example.com"
    When I sign out as a member
    Then I should not be signed in as a member
    And I should see a subscribe button

  Scenario: A member signs in with the code the site e-mails
    Given I am an anonymous user
    And the mailbox is empty
    And I am on the homepage
    When I open the membership sign in form
    And I fill in "Email" with "vera@example.com" in the membership form
    And I submit the membership form
    Then the membership form should show "enter your code below"
    And an e-mail with the subject "with code" should have been sent to "vera@example.com"
    When I enter the code e-mailed to "vera@example.com" in the membership form
    Then I should be signed in as the member "vera@example.com"
    And I should not see a subscribe button
    When I sign out as a member
    Then I should not be signed in as a member

  Scenario: The sign up form refuses an address that is not one
    Given I am an anonymous user
    And I am on the homepage
    When I open the membership sign up form
    And I fill in "Name" with "Suite Visitor" in the membership form
    And I fill in "Email" with "not-an-address" in the membership form
    And I submit the membership form
    Then the membership form should show "Invalid email address"
    And the membership form should not show "Now check your email!"

  Scenario: A visitor signs up and becomes a member
    Given I am logged in to the admin as "owner"
    And there is no member with the email "suite.newcomer@example.com"
    And the mailbox is empty
    When I go to the homepage
    And I open the membership sign up form
    And I fill in "Name" with "Suite Newcomer" in the membership form
    And I fill in "Email" with "suite.newcomer@example.com" in the membership form
    And I submit the membership form
    Then the membership form should show "Now check your email!"
    When I follow the link e-mailed to "suite.newcomer@example.com"
    Then the membership notification should say "You've successfully subscribed to Test site"
    And I should be signed in as the member "suite.newcomer@example.com"
    When I go to the admin screen "Members"
    Then I should see the member "suite.newcomer@example.com" in the list
    Given there is no member with the email "suite.newcomer@example.com"
    Then I should not see the member "suite.newcomer@example.com" in the list
