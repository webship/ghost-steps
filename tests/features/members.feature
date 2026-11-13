@members
Feature: Members in the admin
  Members are listed with their status, searched and filtered by label,
  and created, labelled and deleted from their own screens.

  Background:
    Given I am logged in to the admin as "owner"
    And there is no member with the email "suite.member@example.com"

  @critical
  Scenario: The list shows the members
    When I go to the admin screen "Members"
    Then the list should have 3 members
    And I should see the member "member@example.com" in the list
    And I should see the member "Vera Visitor" in the list
    And I should not see the member "suite.member@example.com" in the list

  Scenario: The members are searched
    When I search the members for "Vera"
    Then the list should have 1 member
    And I should see the member "vera@example.com" in the list
    And I should not see the member "member@example.com" in the list

  Scenario: The members are filtered by label
    When I go to the admin screen "Members"
    And I filter the list by "Label" with "Friend"
    Then the list should have 1 member
    And I should see the member "Vera Visitor" in the list
    When I clear the list filters
    Then the list should have 3 members

  Scenario: A member opens with their labels
    When I go to the admin screen "Members"
    And I open the member "vera@example.com" from the list
    Then the member should have the label "Reader"
    And the member should have the label "Friend"
    And the member should not have the label "Supporter"

  Scenario: A member is created with a label and deleted
    When I go to the admin screen "New member"
    Then the member should not be ready to save
    When I set the member name to "Suite Member"
    And I set the member email to "not-an-address"
    Then the member should not be ready to save
    When I set the member email to "suite.member@example.com"
    And I add the label "Reader" to the member
    And I set the member note to "Made by the suite."
    Then the member should be ready to save
    When I save the member
    Then I should see the notification "Member created"
    When I dismiss the notifications
    Then I should not see the notification "Member created"
    And the member should have the label "Reader"
    When I go to the admin screen "Members"
    Then the list should have 4 members
    And I should see the member "suite.member@example.com" in the list
    When I open the member "suite.member@example.com" from the list
    And I delete the member
    Then I should be on the admin screen "Members"
    And I should see the notification "was deleted"
    And I should not see the member "suite.member@example.com" in the list

  Scenario: Deleting a member asks for a confirmation
    When I go to the admin screen "Members"
    And I open the member "noel@example.com" from the list
    And I choose "Delete member" from the "Actions" menu
    Then I should see the dialog "Delete member account"
    When I answer the dialog with "Cancel"
    Then I should not see the dialog "Delete member account"
    When I go to the admin screen "Members"
    Then I should see the member "noel@example.com" in the list
